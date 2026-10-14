import "server-only";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { processAiJob } from "@/lib/ai/process-job";
import { flushErrors, reportError } from "@/lib/observability/report-error";
import type { AiJobRow } from "@/types/database";

export const processAiInsights = inngest.createFunction(
  {
    id: "process-ai-insights",
    name: "Process AI insights",
    concurrency: 2,
    retries: 2,
    cancelOn: [{
      event: "ai/insights.cancelled",
      if: "event.data.jobId == async.data.jobId",
    }],
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data as { jobId: string };
      const db = createAdminClient();
      const { data: job, error: loadError } = await db
        .from("ai_jobs")
        .select("insight_batch_id, status")
        .eq("id", original.jobId)
        .maybeSingle<Pick<AiJobRow, "insight_batch_id" | "status">>();
      if (loadError) throw loadError;
      if (!job || !["queued", "processing"].includes(job.status)) return;
      const { data: failed, error: jobError } = await db.from("ai_jobs").update({
        status: "dead_letter",
        error_key: "aiFailed",
        error_detail: error.message.slice(0, 2000),
        completed_at: new Date().toISOString(),
        locked_by: null,
        lease_expires_at: null,
      }).eq("id", original.jobId).in("status", ["queued", "processing"])
        .select("insight_batch_id").maybeSingle<Pick<AiJobRow, "insight_batch_id">>();
      if (jobError) throw jobError;
      if (!failed) return;
      // Only a live job transitioned by this callback is an actual terminal
      // failure. Deleted, completed and already-finalized jobs create no issue.
      reportError(error, { operation: "ai.insights.terminal", jobId: original.jobId });
      try {
        const { error: batchError } = await db.from("insight_batches")
          .update({ status: "failed" }).eq("id", failed.insight_batch_id).eq("status", "processing");
        if (batchError) throw batchError;
      } finally {
        await flushErrors();
      }
    },
    triggers: [{ event: "ai/insights.requested" }],
  },
  async ({ event, step }) => {
    const job = await step.run("load-job", async () => {
      const { data, error } = await createAdminClient()
        .from("ai_jobs")
        .select("*")
        .eq("id", event.data.jobId)
        .maybeSingle<AiJobRow>();
      if (error) throw error;
      return data;
    });

    if (!job) return { cancelled: true };
    if (job.status === "completed") return job.result;
    if (!["queued", "processing"].includes(job.status)) return { cancelled: true };

    const processing = await step.run("mark-processing", async () => {
      const { data, error } = await createAdminClient().from("ai_jobs").update({
        status: "processing",
        attempts: job.attempts + 1,
        started_at: job.started_at ?? new Date().toISOString(),
        error_key: null,
        error_detail: null,
      }).eq("id", job.id).in("status", ["queued", "processing"])
        .select("id").maybeSingle<Pick<AiJobRow, "id">>();
      if (error) throw error;
      return Boolean(data);
    });
    // Older deployments cached an empty result for this step. Only an explicit
    // false means the guarded update found no active job; the processor also
    // verifies live state when an old result is replayed.
    if (processing === false) return { cancelled: true };

    // Earlier steps may replay cached results after the report was deleted.
    // The processor checks the live job before work and between external calls.
    const result = await step.run("analyze-batch", () => processAiJob(job));
    if (!result) return { cancelled: true };

    const completed = await step.run("mark-completed", async () => {
      const db = createAdminClient();
      const { data: finished, error: jobError } = await db.from("ai_jobs").update({
        status: "completed",
        result,
        completed_at: new Date().toISOString(),
        locked_by: null,
        lease_expires_at: null,
      }).eq("id", job.id).eq("status", "processing")
        .select("insight_batch_id").maybeSingle<Pick<AiJobRow, "insight_batch_id">>();
      if (jobError) throw jobError;
      if (!finished) return false;
      const { error: batchError } = await db.from("insight_batches")
        .update({ status: "needs_review" }).eq("id", finished.insight_batch_id).eq("status", "processing");
      if (batchError) throw batchError;
      return true;
    });
    if (completed === false) return { cancelled: true };

    return result;
  }
);
