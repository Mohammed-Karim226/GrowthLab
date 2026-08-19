import { apiError, apiOk, notFound, parseBody, withAdmin, writeAuditLog } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { createVersionSchema } from "@/lib/validation/schemas";
import type { MetricRow, ReportVersionRow } from "@/types/database";

type Params = { params: Promise<{ reportId: string }> };

/**
 * Start a new draft version of a report.
 *
 * A published version is immutable — clients may already have read it — so a
 * correction becomes version n+1. The published one keeps serving the portal
 * until the new version is itself published (plan §35, §36).
 */
export const POST = withAdmin<[Params]>("createVersion", async (session, request, { params }) => {
  const { reportId } = await params;

  const parsed = await parseBody(request, createVersionSchema);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.reportId !== reportId) return apiError(422, "validationFailed");

  const supabase = await createClient();

  const { data: report, error } = await supabase
    .from("reports")
    // FK named explicitly: `reports.current_published_version_id` also points
    // here, so an unqualified embed is ambiguous (PGRST201).
    .select(
      "id, current_published_version_id, report_versions!report_versions_report_id_fkey(id, version_number, status, summary)"
    )
    .eq("id", reportId)
    .maybeSingle<{
      id: string;
      current_published_version_id: string | null;
      report_versions: Array<{
        id: string;
        version_number: number;
        status: string;
        summary: string | null;
      }>;
    }>();

  if (error) throw error;
  if (!report) return notFound();

  const versions = [...report.report_versions].sort(
    (a, b) => b.version_number - a.version_number
  );
  const latest = versions[0];

  // One draft at a time. A second open draft would make "the newest version"
  // ambiguous everywhere it is read.
  if (latest && latest.status !== "published" && latest.status !== "archived") {
    return apiError(409, "draftExists");
  }

  const nextNumber = (latest?.version_number ?? 0) + 1;

  const { data: created, error: createError } = await supabase
    .from("report_versions")
    .insert({
      report_id: reportId,
      version_number: nextNumber,
      status: "draft",
      summary: latest?.summary ?? null,
      created_by: session.userId,
    })
    .select("*")
    .maybeSingle<ReportVersionRow>();

  if (createError || !created) {
    throw createError ?? new Error("report_versions insert returned no row");
  }

  let carriedOver = 0;

  if (parsed.data.carryOverMetrics && latest) {
    const { data: previousMetrics, error: metricsError } = await supabase
      .from("metrics")
      .select("*")
      .eq("report_version_id", latest.id)
      .returns<MetricRow[]>();

    if (metricsError) throw metricsError;

    if (previousMetrics && previousMetrics.length > 0) {
      const rows = previousMetrics.map((metric) => ({
        report_version_id: created.id,
        // Deliberately not carried: the new version has no batches of its own,
        // and pointing at the old version's batch would misattribute the source.
        insight_batch_id: null,
        platform: metric.platform,
        metric_name: metric.metric_name,
        metric_value: metric.metric_value,
        metric_unit: metric.metric_unit,
        metric_date: metric.metric_date,
        // 'imported' rather than 'ai': these came from an approved version,
        // not from a fresh model reading (plan §4).
        source: "imported" as const,
        confidence: null,
        needs_review: false,
        note: metric.note,
      }));

      const { error: copyError } = await supabase.from("metrics").insert(rows as never);
      if (copyError) throw copyError;

      carriedOver = rows.length;
    }
  }

  await writeAuditLog(supabase, {
    actor_id: session.userId,
    action: "VERSION_CREATED",
    entity_type: "report_version",
    entity_id: created.id,
    metadata: {
      report_id: reportId,
      version_number: nextNumber,
      carried_over: carriedOver,
      from_version: latest?.id ?? null,
    },
  });

  return apiOk({ version: created, carriedOver }, 201);
});
