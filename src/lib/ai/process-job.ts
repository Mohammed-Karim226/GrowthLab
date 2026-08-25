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

export async function processAiJob(job: AiJobRow): Promise<AiJobResult> {
  const db = createAdminClient();
  const { data: batch, error } = await db.from("insight_batches")
    .select("id, platform, notes, report_version_id, report_versions(status), insight_images(id, storage_path, mime_type, sort_order)")
    .eq("id", job.insight_batch_id).maybeSingle<Batch>();
  if (error || !batch || !batch.report_versions) throw new Error(error?.message ?? "batch not found");
  if (["published", "archived"].includes(batch.report_versions.status)) throw new AiProviderError("bad_response", "Report version is locked");

  const provider = getAiProvider();
  const { data: previous } = await db.from("ai_analyses").select("attempt").eq("insight_batch_id", batch.id).order("attempt", { ascending: false }).limit(1);
  const { data: analysis, error: analysisError } = await db.from("ai_analyses").insert({
    insight_batch_id: batch.id, provider: provider.name, model: provider.model,
    attempt: (previous?.[0]?.attempt ?? 0) + 1, status: "processing", image_count: batch.insight_images.length, created_by: job.requested_by,
  }).select("id").single();
  if (analysisError || !analysis) throw new Error(analysisError?.message ?? "analysis insert failed");

  try {
    const { images } = await loadBatchImages(batch.insight_images);
    const completion = await withRetry(() => provider.complete({
      systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
      prompt: buildExtractionPrompt({ platform: batch.platform, imageCount: images.length, adminNotes: batch.notes }), images, temperature: 0,
    }));
    const validated = parseModelJson(extractionResultSchema, completion.json);
    if (!validated.ok) throw new AiProviderError("bad_response", `Schema mismatch: ${validated.issues.join("; ")}`);
    const extraction = prepareExtraction(validated.data, batch.platform);
    const { error: clearError } = await db.from("metrics").delete().eq("insight_batch_id", batch.id).eq("source", "ai");
    if (clearError) throw clearError;
    if (extraction.metrics.length) {
      const { error: insertError } = await db.from("metrics").insert(metricRowsFor({ reportVersionId: batch.report_version_id, insightBatchId: batch.id, platform: batch.platform, metrics: extraction.metrics }) as never);
      if (insertError) throw insertError;
    }
    const summary = reviewSummary(extraction.metrics);
    const { error: completeError } = await db.from("ai_analyses").update({ status: "completed", raw_response: completion.raw, structured_response: validated.data, completed_at: new Date().toISOString() }).eq("id", analysis.id);
    if (completeError) throw completeError;
    return { total: summary.total, needsReview: summary.needsReview, unreadable: extraction.unreadable };
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    await db.from("ai_analyses").update({ status: "failed", error_message: detail.slice(0, 2000), completed_at: new Date().toISOString() }).eq("id", analysis.id);
    throw cause;
  }
}
