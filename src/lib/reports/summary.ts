import "server-only";

import { apiError, notFound } from "@/lib/api";
import type { createClient } from "@/lib/supabase/server";
import type { AiSummaryPayload } from "@/types/database";

/** Save the copy, review status and audit record in one guarded transaction. */
export async function saveReportSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    reportId: string;
    versionId: string;
    revision: number;
    summary: AiSummaryPayload;
    action: "generate" | "edit";
    metadata?: Record<string, unknown>;
  }
) {
  const { data: version, error } = await supabase.rpc("save_report_summary", {
    p_report: input.reportId,
    p_version: input.versionId,
    p_revision: input.revision,
    p_summary: input.summary,
    p_action: input.action,
    p_metadata: input.metadata ?? {},
  });

  if (error) {
    if (error.code === "40001") {
      return { ok: false as const, response: apiError(409, "staleReport") };
    }
    if (error.code === "55000") {
      if (error.message === "report missing" || error.message === "version mismatch") {
        return { ok: false as const, response: notFound() };
      }
      if (error.message === "active job") {
        return { ok: false as const, response: apiError(409, "batchProcessing") };
      }
      if (error.message === "version locked") {
        return { ok: false as const, response: apiError(409, "versionLocked") };
      }
    }
    throw error;
  }
  if (!version?.ai_summary) throw new Error("Summary save returned no summary");

  return { ok: true as const, version };
}
