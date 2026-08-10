import { apiError, apiOk, notFound, parseBody, withAdmin, writeAuditLog } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { getAiProvider } from "@/lib/ai";
import {
  aiSummarySchema,
  buildInterpretationPrompt,
  generateSummarySchema,
  INTERPRETATION_SYSTEM_INSTRUCTION,
  parseModelJson,
} from "@/lib/ai";
import { AiProviderError, errorKeyFor, withRetry } from "@/lib/ai/provider";
import { buildInterpretationPayload } from "@/lib/ai/interpretation";
import { comparePeriods } from "@/lib/analytics/comparisons";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { formatDateRange } from "@/lib/format";
import { PLATFORMS, type AiSummaryPayload, type MetricRow } from "@/types/database";

/**
 * Write the narrative for a report version.
 *
 * The model never sees a screenshot here and never computes anything: the
 * application calculates the comparison, serialises it, and asks for prose about
 * those exact figures (plan §4, §21).
 *
 * Metrics still flagged needs_review are excluded from the calculation, so the
 * summary can never describe a number a human has not signed off.
 */

type VersionLookup = {
  id: string;
  status: string;
  report_id: string;
  ai_summary: AiSummaryPayload | null;
  reports: {
    id: string;
    title: string;
    client_id: string;
    period_start: string;
    period_end: string;
    clients: { name: string } | null;
  } | null;
};

type Params = { params: Promise<{ reportId: string }> };

export const POST = withAdmin<[Params]>("generateSummary", async (session, request, { params }) => {
  const { reportId } = await params;

  const parsed = await parseBody(request, generateSummarySchema);
  if (!parsed.ok) return parsed.response;

  const { reportVersionId, force } = parsed.data;
  const supabase = await createClient();

  const { data: version, error: versionError } = await supabase
    .from("report_versions")
    .select(
      // FK named explicitly: two foreign keys join reports and report_versions,
      // so an unqualified `reports(...)` is ambiguous (PGRST201).
      "id, status, report_id, ai_summary, reports!report_versions_report_id_fkey(id, title, client_id, period_start, period_end, clients(name))"
    )
    .eq("id", reportVersionId)
    .maybeSingle<VersionLookup>();

  if (versionError) throw versionError;
  if (!version || !version.reports) return notFound();

  // The version must belong to the report in the path. Without this the URL
  // would be decorative and a valid version id would work under any report.
  if (version.report_id !== reportId) return notFound();

  if (version.status === "published" || version.status === "archived") {
    return apiError(409, "versionLocked");
  }
  if (version.ai_summary && !force) return apiError(409, "summaryExists");

  const report = version.reports;

  const { data: metrics, error: metricsError } = await supabase
    .from("metrics")
    .select("*")
    .eq("report_version_id", version.id)
    .returns<MetricRow[]>();

  if (metricsError) throw metricsError;

  // Only reviewed values feed the narrative (plan §30).
  const settled = (metrics ?? []).filter(
    (metric) => !metric.needs_review && metric.metric_value !== null
  );

  if (settled.length === 0) return apiError(422, "noMetrics");

  // Previous published period for the same client, for period-over-period text.
  const previousMetrics = await loadPreviousMetrics(
    supabase,
    report.client_id,
    report.period_start,
    report.id
  );

  const comparison = comparePeriods(settled, previousMetrics?.metrics ?? null);
  const payload = buildInterpretationPayload(comparison, settled, PLATFORMS);

  const localeParam = new URL(request.url).searchParams.get("locale");
  const locale = isLocale(localeParam ?? "") ? (localeParam as "en" | "ar") : defaultLocale;

  const provider = getAiProvider();

  let raw: string;
  let json: unknown;
  try {
    const completion = await withRetry(() =>
      provider.complete({
        systemInstruction: INTERPRETATION_SYSTEM_INSTRUCTION,
        prompt: buildInterpretationPrompt({
          clientName: report.clients?.name ?? "",
          periodLabel: formatDateRange(report.period_start, report.period_end, "en"),
          previousPeriodLabel: previousMetrics?.label ?? null,
          analytics: payload,
          locale,
        }),
        // Slightly above zero: this is prose, and a fully greedy decode reads
        // like a template. The figures come from `payload`, not from sampling.
        temperature: 0.3,
        maxOutputTokens: 4096,
      })
    );
    raw = completion.raw;
    json = completion.json;
  } catch (cause) {
    const kind = cause instanceof AiProviderError ? cause.kind : "unknown";
    console.error("[api:generateSummary]", version.id, kind, cause);
    return apiError(kind === "rate_limit" ? 429 : 502, errorKeyFor(kind));
  }

  const validated = parseModelJson(aiSummarySchema, json);

  if (!validated.ok) {
    console.error("[api:generateSummary] schema mismatch", version.id, validated.issues, raw.slice(0, 500));
    return apiError(502, "aiBadResponse");
  }

  // generated_at is stamped here, never taken from the model.
  const aiSummary: AiSummaryPayload = {
    ...validated.data,
    generated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("report_versions")
    .update({ ai_summary: aiSummary, status: "needs_review" })
    .eq("id", version.id);

  if (updateError) throw updateError;

  await writeAuditLog(supabase, {
    actor_id: session.userId,
    action: "SUMMARY_GENERATED",
    entity_type: "report_version",
    entity_id: version.id,
    metadata: {
      locale,
      metrics_used: settled.length,
      compared_against: previousMetrics?.versionId ?? null,
      regenerated: Boolean(version.ai_summary),
    },
  });

  return apiOk({ aiSummary, metricsUsed: settled.length, comparedAgainst: previousMetrics?.label ?? null });
});

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The client's most recent published period that ended before this one began.
 *
 * Published only: comparing against a draft would let unapproved numbers shape
 * the narrative of an approved report.
 */
async function loadPreviousMetrics(
  supabase: SupabaseServerClient,
  clientId: string,
  periodStart: string,
  excludeReportId: string
): Promise<{ label: string; versionId: string; metrics: MetricRow[] } | null> {
  const { data: previousReport } = await supabase
    .from("reports")
    .select("id, title, period_start, period_end, current_published_version_id")
    .eq("client_id", clientId)
    .neq("id", excludeReportId)
    .not("current_published_version_id", "is", null)
    .lt("period_end", periodStart)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      title: string;
      period_start: string;
      period_end: string;
      current_published_version_id: string;
    }>();

  if (!previousReport) return null;

  const { data: metrics } = await supabase
    .from("metrics")
    .select("*")
    .eq("report_version_id", previousReport.current_published_version_id)
    .returns<MetricRow[]>();

  if (!metrics || metrics.length === 0) return null;

  return {
    label: formatDateRange(previousReport.period_start, previousReport.period_end, "en"),
    versionId: previousReport.current_published_version_id,
    metrics: metrics.filter((metric) => metric.metric_value !== null),
  };
}
