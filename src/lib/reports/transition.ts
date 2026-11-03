import "server-only";

import { z } from "zod";
import { apiError, apiOk, notFound } from "@/lib/api";
import type { createClient } from "@/lib/supabase/server";
import type { ReportVersionRow } from "@/types/database";

type Client = Awaited<ReturnType<typeof createClient>>;
type Action = "approve" | "publish" | "unpublish";
type TransitionInput = {
  reportVersionId: string;
  revision?: number;
  expectedPublishedVersionId?: string | null;
  summary?: string | null;
};
type Version = Pick<ReportVersionRow, "id" | "report_id" | "status" | "revision" | "summary">;

function transitionError(error: { code: string; message: string }, action: Action) {
  if (error.code === "40001") return apiError(409, "staleReport");
  if (error.code === "55000") {
    switch (error.message) {
      case "report missing":
      case "version mismatch":
        return notFound();
      case "active job":
        return apiError(409, "batchProcessing");
      case "review required":
        return apiError(409, "reviewPending");
      case "approval required":
        return apiError(409, "notApproved");
      case "invalid state":
        return apiError(409, action === "unpublish" ? "notPublished" : "versionLocked");
    }
  }
  throw error;
}

/** Keep publication, version status and audit history in the same DB transaction. */
export async function transitionReport(
  supabase: Client,
  reportId: string,
  input: TransitionInput,
  action: Action
) {
  if (!z.string().uuid().safeParse(reportId).success) return notFound();

  const [reportResult, versionResult] = await Promise.all([
    supabase.from("reports").select("id, current_published_version_id").eq("id", reportId)
      .maybeSingle<{ id: string; current_published_version_id: string | null }>(),
    supabase.from("report_versions").select("id, report_id, status, revision, summary")
      .eq("id", input.reportVersionId).eq("report_id", reportId).maybeSingle<Version>(),
  ]);
  if (reportResult.error) throw reportResult.error;
  if (versionResult.error) throw versionResult.error;
  const report = reportResult.data;
  const version = versionResult.data;
  if (!report || !version || version.report_id !== reportId) return notFound();

  if (
    (input.revision !== undefined && input.revision !== version.revision) ||
    (input.expectedPublishedVersionId !== undefined &&
      input.expectedPublishedVersionId !== report.current_published_version_id)
  ) return apiError(409, "staleReport");

  if (action === "unpublish" &&
    (report.current_published_version_id !== version.id || version.status !== "published")) {
    return apiError(409, "notPublished");
  }
  if (action === "publish") {
    if (version.status === "published") return apiError(409, "alreadyPublished");
    if (version.status !== "approved") return apiError(409, "notApproved");
    // Approved copy is sealed. Changes must be reviewed before publication.
    if (input.summary !== undefined && input.summary !== version.summary) {
      return apiError(409, "versionLocked");
    }
  }

  let revision = version.revision;
  if (action === "approve") {
    if (!["draft", "needs_review", "failed"].includes(version.status)) {
      return apiError(409, "versionLocked");
    }
    const { data: metrics, error } = await supabase.from("metrics").select("id, needs_review")
      .eq("report_version_id", version.id).returns<Array<{ id: string; needs_review: boolean }>>();
    if (error) throw error;
    if (!metrics?.length) return apiError(422, "noMetrics");
    if (metrics.some((metric) => metric.needs_review)) return apiError(409, "reviewPending");

    if (input.summary !== undefined && input.summary !== version.summary) {
      const { data: saved, error: saveError } = await supabase.from("report_versions")
        .update({ summary: input.summary }).eq("id", version.id).eq("revision", revision)
        .select("revision").maybeSingle<{ revision: number }>();
      if (saveError) throw saveError;
      if (!saved) return apiError(409, "staleReport");
      revision = saved.revision;
    }
  }

  // The RPC locks both rows and checks this snapshot again, preventing a stale
  // withdrawal from clearing a replacement published by another administrator.
  const { data: transitioned, error } = await supabase.rpc("transition_report", {
    p_report: reportId,
    p_version: version.id,
    p_revision: revision,
    p_expected_published: report.current_published_version_id,
    p_action: action,
  });
  if (error) return transitionError(error, action);
  if (!transitioned) throw new Error("Report transition returned no version");

  return apiOk({
    versionId: transitioned.id,
    status: transitioned.status,
    ...(action === "publish" ? { publishedAt: transitioned.published_at } : {}),
  });
}
