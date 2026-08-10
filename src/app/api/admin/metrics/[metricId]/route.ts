import { apiError, apiOk, notFound, parseBody, withAdmin, writeAuditLog } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { updateMetricSchema } from "@/lib/validation/schemas";
import type { MetricRow } from "@/types/database";

type Params = { params: Promise<{ metricId: string }> };

/**
 * Correct a metric by hand.
 *
 * Any edit flips `source` to 'manual' and clears `confidence`: the value is no
 * longer the model's claim, and keeping the old confidence would attach the
 * AI's certainty to a human's number. A re-run of the analysis deletes only
 * source='ai' rows, so corrections survive it (plan §31).
 */
export const PATCH = withAdmin<[Params]>("updateMetric", async (session, request, { params }) => {
  const { metricId } = await params;

  const parsed = await parseBody(request, updateMetricSchema);
  if (!parsed.ok) return parsed.response;

  const supabase = await createClient();

  const { data: existing, error } = await supabase
    .from("metrics")
    .select("id, report_version_id, metric_value, metric_name, report_versions(id, status)")
    .eq("id", metricId)
    .maybeSingle<{
      id: string;
      report_version_id: string;
      metric_value: number | null;
      metric_name: string;
      report_versions: { id: string; status: string } | null;
    }>();

  if (error) throw error;
  if (!existing || !existing.report_versions) return notFound();

  if (
    existing.report_versions.status === "published" ||
    existing.report_versions.status === "archived"
  ) {
    return apiError(409, "versionLocked");
  }

  const input = parsed.data;
  const valueChanged = "metricValue" in input && input.metricValue !== existing.metric_value;

  const patch: Record<string, unknown> = {
    ...(input.metricName !== undefined ? { metric_name: input.metricName } : {}),
    ...(input.metricValue !== undefined ? { metric_value: input.metricValue } : {}),
    ...(input.metricUnit !== undefined ? { metric_unit: input.metricUnit } : {}),
    ...(input.metricDate !== undefined ? { metric_date: input.metricDate } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
  };

  if (valueChanged) {
    patch.source = "manual";
    patch.confidence = null;
    // An edited value is reviewed by definition — the admin just supplied it.
    patch.needs_review = false;
  }

  // An explicit needsReview flag wins: an admin may deliberately re-flag a row.
  if (input.needsReview !== undefined) patch.needs_review = input.needsReview;

  const { data: updated, error: updateError } = await supabase
    .from("metrics")
    .update(patch)
    .eq("id", metricId)
    .select("*")
    .maybeSingle<MetricRow>();

  if (updateError) throw updateError;
  if (!updated) return notFound();

  await writeAuditLog(supabase, {
    actor_id: session.userId,
    action: "METRIC_UPDATED",
    entity_type: "metric",
    entity_id: metricId,
    metadata: {
      metric_name: updated.metric_name,
      // Both sides recorded so a published number can be traced to its edit.
      previous_value: existing.metric_value,
      new_value: updated.metric_value,
    },
  });

  return apiOk({ metric: updated });
});

/**
 * Delete a metric the AI hallucinated or that does not belong in the report.
 *
 * Hard delete rather than a soft flag: an unpublished draft has no history to
 * preserve, and a row kept "just in case" is a row that can leak into a total.
 */
export const DELETE = withAdmin<[Params]>("deleteMetric", async (session, _request, { params }) => {
  const { metricId } = await params;
  const supabase = await createClient();

  const { data: existing, error } = await supabase
    .from("metrics")
    .select("id, metric_name, platform, report_versions(id, status)")
    .eq("id", metricId)
    .maybeSingle<{
      id: string;
      metric_name: string;
      platform: string;
      report_versions: { id: string; status: string } | null;
    }>();

  if (error) throw error;
  if (!existing || !existing.report_versions) return notFound();

  if (
    existing.report_versions.status === "published" ||
    existing.report_versions.status === "archived"
  ) {
    return apiError(409, "versionLocked");
  }

  const { error: deleteError } = await supabase.from("metrics").delete().eq("id", metricId);
  if (deleteError) throw deleteError;

  await writeAuditLog(supabase, {
    actor_id: session.userId,
    action: "METRIC_DELETED",
    entity_type: "metric",
    entity_id: metricId,
    metadata: { metric_name: existing.metric_name, platform: existing.platform },
  });

  return apiOk({ deleted: metricId });
});
