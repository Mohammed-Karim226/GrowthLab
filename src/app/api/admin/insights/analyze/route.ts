import { apiError, apiOk, notFound, parseBody, withAdmin } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { analyzeBatchSchema } from "@/lib/ai";
import { inngest } from "@/lib/inngest/client";

/** Enqueue only. Gemini work is performed by the Inngest function. */
export const POST = withAdmin("enqueueInsights", async (session, request) => {
  const parsed = await parseBody(request, analyzeBatchSchema);
  if (!parsed.ok) return parsed.response;
  const supabase = await createClient();
  const { data: batch, error } = await supabase.from("insight_batches")
    .select("id, status, insight_images(id)").eq("id", parsed.data.insightBatchId)
    .maybeSingle<{ id: string; status: string; insight_images: Array<{ id: string }> }>();
  if (error) throw error;
  if (!batch) return notFound();
  if (batch.insight_images.length === 0) return apiError(422, "noImages");
  if (batch.status === "processing") return apiError(409, "batchProcessing");
  if (!parsed.data.force && !["uploaded", "needs_review", "failed"].includes(batch.status)) return apiError(409, "batchLocked");

  const { data: previous, error: previousError } = await supabase.from("ai_analyses")
    .select("status").eq("insight_batch_id", batch.id).eq("status", "completed").limit(1);
  if (previousError) throw previousError;
  if (!parsed.data.force && previous?.length) return apiError(409, "analysisExists");

  const { data: job, error: jobError } = await supabase.rpc("enqueue_ai_job", {
    batch_id: batch.id, force_requested: Boolean(parsed.data.force),
  });
  if (jobError || !job) throw jobError ?? new Error("job enqueue returned no row");
  await inngest.send({
    name: "ai/insights.requested",
    id: job.id,
    data: { jobId: job.id, insightBatchId: batch.id },
  });
  return apiOk({ jobId: job.id, status: job.status, requestedBy: session.userId }, 202);
});
