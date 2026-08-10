import { apiError, apiOk, notFound, parseBody, withAdmin, writeAuditLog } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { approveVersionSchema } from "@/lib/validation/schemas";
import type { MetricRow } from "@/types/database";

type Params = { params: Promise<{ reportId: string }> };

/**
 * Approve a version for publishing.
 *
 * The gate between AI output and a client's screen. Approval is refused while
 * any metric is still flagged needs_review — that flag exists precisely so an
 * unverified number cannot slip through (plan §30, §33).
 */
export const POST = withAdmin<[Params]>("approveVersion", async (session, request, { params }) => {
  const { reportId } = await params;

  const parsed = await parseBody(request, approveVersionSchema);
  if (!parsed.ok) return parsed.response;

  const { reportVersionId, summary } = parsed.data;
  const supabase = await createClient();

  const { data: version, error } = await supabase
    .from("report_versions")
    .select("id, report_id, status, version_number")
    .eq("id", reportVersionId)
    .maybeSingle<{ id: string; report_id: string; status: string; version_number: number }>();

  if (error) throw error;
  if (!version) return notFound();
  if (version.report_id !== reportId) return notFound();

  if (version.status === "published" || version.status === "archived") {
    return apiError(409, "versionLocked");
  }

  const { data: metrics, error: metricsError } = await supabase
    .from("metrics")
    .select("id, needs_review, metric_value")
    .eq("report_version_id", version.id)
    .returns<Pick<MetricRow, "id" | "needs_review" | "metric_value">[]>();

  if (metricsError) throw metricsError;

  if (!metrics || metrics.length === 0) return apiError(422, "noMetrics");

  const pending = metrics.filter((metric) => metric.needs_review).length;
  if (pending > 0) return apiError(409, "reviewPending");

  const { error: updateError } = await supabase
    .from("report_versions")
    .update({
      status: "approved",
      ...(summary !== undefined ? { summary } : {}),
    })
    .eq("id", version.id);

  if (updateError) throw updateError;

  // Batches follow the version: an approved report has no batch still sitting
  // in review, so the workspace badges stay truthful.
  await supabase
    .from("insight_batches")
    .update({ status: "approved" })
    .eq("report_version_id", version.id)
    .eq("status", "needs_review");

  await writeAuditLog(supabase, {
    actor_id: session.userId,
    action: "VERSION_APPROVED",
    entity_type: "report_version",
    entity_id: version.id,
    metadata: { version_number: version.version_number, metric_count: metrics.length },
  });

  return apiOk({ versionId: version.id, status: "approved" as const });
});
