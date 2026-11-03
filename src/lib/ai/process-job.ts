import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAiProvider } from "@/lib/ai";
import { loadBatchImages, metricRowsFor, type StoredImage } from "@/lib/ai/analyze-batch";
import { prepareExtraction, reviewSummary } from "@/lib/ai/extraction";
import { AiProviderError, withRetry } from "@/lib/ai/provider";
import { buildExtractionPrompt, EXTRACTION_SYSTEM_INSTRUCTION, extractionResultSchema, parseModelJson } from "@/lib/ai";
import type { AiJobRow, Platform } from "@/types/database";

type Batch = { id: string; platform: Platform; notes: string | null; report_version_id: string; report_versions: { status: string } | null; insight_images: StoredImage[] };

export type AiJobResult = {
  total: number;
  needsReview: number;
  unreadable: string[];
};

/** Check durable state; a cached Inngest step can outlive a deleted report. */
async function jobIsActive(db: ReturnType<typeof createAdminClient>, jobId: string): Promise<boolean> {
  const { data, error } = await db.from("ai_jobs").select("status")
    .eq("id", jobId).maybeSingle<Pick<AiJobRow, "status">>();
  if (error) throw error;
  return Boolean(data && ["queued", "processing"].includes(data.status));
}

/** Only missing-parent/row errors can be explained by a concurrent deletion. */
function canBeDeletionRace(cause: unknown): boolean {
  if (!cause || typeof cause !== "object" || !("code" in cause)) return true;
  return ["23503", "55000", "PGRST116"].includes(String(cause.code));
}

export async function processAiJob(job: AiJobRow): Promise<AiJobResult | null> {
  const db = createAdminClient();
  if (!(await jobIsActive(db, job.id))) return null;
  let analysisId: string | null = null;

  try {
    const { data: batch, error } = await db.from("insight_batches")
      .select("id, platform, notes, report_version_id, report_versions(status), insight_images(id, storage_path, mime_type, sort_order)")
      .eq("id", job.insight_batch_id).maybeSingle<Batch>();
    if (error) throw error;
    if (!batch || !batch.report_versions) throw new Error("batch not found");
    if (["approved", "published", "archived"].includes(batch.report_versions.status)) {
      throw new AiProviderError("bad_response", "Report version is locked");
    }

    const provider = getAiProvider();
    const { data: previous, error: previousError } = await db.from("ai_analyses")
      .select("attempt").eq("insight_batch_id", batch.id).order("attempt", { ascending: false }).limit(1);
    if (previousError) throw previousError;
    if (!(await jobIsActive(db, job.id))) return null;
    const { data: analysis, error: analysisError } = await db.from("ai_analyses").insert({
      insight_batch_id: batch.id, provider: provider.name, model: provider.model,
      attempt: (previous?.[0]?.attempt ?? 0) + 1, status: "processing", image_count: batch.insight_images.length, created_by: job.requested_by,
    }).select("id").single();
    if (analysisError) throw analysisError;
    if (!analysis) throw new Error("analysis insert failed");
    analysisId = analysis.id;

    if (!(await jobIsActive(db, job.id))) return null;
    const { images } = await loadBatchImages(batch.insight_images);
    const completion = await withRetry(async () => {
      if (!(await jobIsActive(db, job.id))) return null;
      try {
        return await provider.complete({
          systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
          prompt: buildExtractionPrompt({ platform: batch.platform, imageCount: images.length, adminNotes: batch.notes }), images, temperature: 0,
        });
      } catch (cause) {
        // Do not spend another provider attempt on screenshots whose report
        // was deleted while the previous request was in flight.
        if (!(await jobIsActive(db, job.id))) return null;
        throw cause;
      }
    });
    if (!completion || !(await jobIsActive(db, job.id))) return null;
    const validated = parseModelJson(extractionResultSchema, completion.json);
    if (!validated.ok) throw new AiProviderError("bad_response", `Schema mismatch: ${validated.issues.join("; ")}`);
    const extraction = prepareExtraction(validated.data, batch.platform);
    const { error: clearError } = await db.from("metrics").delete().eq("insight_batch_id", batch.id).eq("source", "ai");
    if (clearError) throw clearError;
    if (extraction.metrics.length) {
      if (!(await jobIsActive(db, job.id))) return null;
      const { error: insertError } = await db.from("metrics").insert(metricRowsFor({ reportVersionId: batch.report_version_id, insightBatchId: batch.id, platform: batch.platform, metrics: extraction.metrics }) as never);
      if (insertError) throw insertError;
    }
    const summary = reviewSummary(extraction.metrics);
    if (!(await jobIsActive(db, job.id))) return null;
    const { data: completed, error: completeError } = await db.from("ai_analyses")
      .update({ status: "completed", raw_response: completion.raw, structured_response: validated.data, completed_at: new Date().toISOString() })
      .eq("id", analysisId).eq("status", "processing").select("id").maybeSingle<{ id: string }>();
    if (completeError) throw completeError;
    if (!completed) {
      if (!(await jobIsActive(db, job.id))) return null;
      throw new Error("analysis completion returned no row");
    }
    return { total: summary.total, needsReview: summary.needsReview, unreadable: extraction.unreadable };
  } catch (cause) {
    // FK/version guards cover the final gap between a liveness check and a
    // write. Permission errors and database outages must still surface.
    if (canBeDeletionRace(cause) && !(await jobIsActive(db, job.id))) return null;
    const detail = cause instanceof Error ? cause.message : String(cause);
    if (analysisId) {
      const { error: failureError } = await db.from("ai_analyses")
        .update({ status: "failed", error_message: detail.slice(0, 2000), completed_at: new Date().toISOString() })
        .eq("id", analysisId).eq("status", "processing");
      if (failureError) throw failureError;
    }
    if (canBeDeletionRace(cause) && !(await jobIsActive(db, job.id))) return null;
    throw cause;
  }
}
