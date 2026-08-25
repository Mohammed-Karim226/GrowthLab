import "server-only";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { processAiJob } from "@/lib/ai/process-job";
import type { AiJobRow } from "@/types/database";

export const processAiInsights = inngest.createFunction(
  {
    id: "process-ai-insights",
    name: "Process AI insights",
    concurrency: 2,
    retries: 2,
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data as { jobId: string };
      const db = createAdminClient();
      const { data: job, error: loadError } = await db
        .from("ai_jobs")
        .select("insight_batch_id")
        .eq("id", original.jobId)
        .maybeSingle<{ insight_batch_id: string }>();
      if (loadError) throw loadError;
      if (!job) return;
      const { error: jobError } = await db.from("ai_jobs").update({
        status: "dead_letter",
        error_key: "aiFailed",
        error_detail: error.message.slice(0, 2000),
        completed_at: new Date().toISOString(),
        locked_by: null,
        lease_expires_at: null,
      }).eq("id", original.jobId);
      if (jobError) throw jobError;
      const { error: batchError } = await db.from("insight_batches")
        .update({ status: "failed" }).eq("id", job.insight_batch_id);
      if (batchError) throw batchError;
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

    if (!job) throw new Error("AI job not found");
    if (job.status === "completed") return job.result;

    await step.run("mark-processing", async () => {
      const { error } = await createAdminClient().from("ai_jobs").update({
        status: "processing",
        attempts: job.attempts + 1,
        started_at: job.started_at ?? new Date().toISOString(),
        error_key: null,
        error_detail: null,
      }).eq("id", job.id);
      if (error) throw error;
    });

    const result = await step.run("analyze-batch", () => processAiJob(job));

    await step.run("mark-completed", async () => {
      const db = createAdminClient();
      const { error: jobError } = await db.from("ai_jobs").update({
        status: "completed",
        result,
        completed_at: new Date().toISOString(),
        locked_by: null,
        lease_expires_at: null,
      }).eq("id", job.id);
      if (jobError) throw jobError;
      const { error: batchError } = await db.from("insight_batches")
        .update({ status: "needs_review" }).eq("id", job.insight_batch_id);
      if (batchError) throw batchError;
    });

    return result;
  }
);
