import { apiError, apiOk, notFound, parseBody, withAdmin, writeAuditLog } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { getAiProvider } from "@/lib/ai";
import { loadBatchImages, metricRowsFor, type StoredImage } from "@/lib/ai/analyze-batch";
import { prepareExtraction, reviewSummary } from "@/lib/ai/extraction";
import {
  AiProviderError,
  errorKeyFor,
  withRetry,
  type AiFailureKind,
  type CompletionResult,
} from "@/lib/ai/provider";
import {
  analyzeBatchSchema,
  buildExtractionPrompt,
  EXTRACTION_SYSTEM_INSTRUCTION,
  extractionResultSchema,
  parseModelJson,
} from "@/lib/ai";
import type { Platform } from "@/types/database";

/**
 * Run the vision extraction for one platform batch.
 *
 * Sequence, and why: authorise through RLS → claim the batch by moving it to
 * `processing` (which is also the duplicate-run lock, plan §19) → call the model
 * → validate → write metrics. The claim happens before the expensive call so two
 * admins pressing the button together cannot both spend a request.
 *
 * The route never returns a provider message, a prompt, or a raw model response.
 * Those live in ai_analyses and the server log (plan §17, §52).
 */

const ANALYZABLE_STATUSES = ["uploaded", "needs_review", "failed"] as const;

type BatchLookup = {
  id: string;
  platform: Platform;
  status: string;
  notes: string | null;
  report_version_id: string;
  report_versions: { id: string; status: string; report_id: string } | null;
  insight_images: StoredImage[];
};

export const POST = withAdmin("analyzeInsights", async (session, request) => {
  const parsed = await parseBody(request, analyzeBatchSchema);
  if (!parsed.ok) return parsed.response;

  const { insightBatchId, force } = parsed.data;
  const supabase = await createClient();

  const { data: batch, error: batchError } = await supabase
    .from("insight_batches")
    .select(
      "id, platform, status, notes, report_version_id, report_versions(id, status, report_id), insight_images(id, storage_path, mime_type, sort_order)"
    )
    .eq("id", insightBatchId)
    .maybeSingle<BatchLookup>();

  if (batchError) throw batchError;
  if (!batch || !batch.report_versions) return notFound();

  const version = batch.report_versions;

  if (version.status === "published" || version.status === "archived") {
    return apiError(409, "versionLocked");
  }
  if (batch.status === "processing") return apiError(409, "batchProcessing");
  if (batch.insight_images.length === 0) return apiError(422, "noImages");

  if (!force && !(ANALYZABLE_STATUSES as readonly string[]).includes(batch.status)) {
    return apiError(409, "batchLocked");
  }

  // Existing completed analysis + no explicit force = refuse, so a double click
  // does not silently overwrite metrics an admin may already have corrected.
  const { data: previous, error: previousError } = await supabase
    .from("ai_analyses")
    .select("id, status, attempt")
    .eq("insight_batch_id", batch.id)
    .order("attempt", { ascending: false })
    .limit(1);

  if (previousError) throw previousError;

  const lastAttempt = previous?.[0]?.attempt ?? 0;
  if (!force && previous?.[0]?.status === "completed") {
    return apiError(409, "analysisExists");
  }

  const provider = getAiProvider();
  const batchId = batch.id;

  const { data: analysis, error: analysisError } = await supabase
    .from("ai_analyses")
    .insert({
      insight_batch_id: batch.id,
      provider: provider.name,
      model: provider.model,
      attempt: lastAttempt + 1,
      status: "processing",
      image_count: batch.insight_images.length,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (analysisError || !analysis) {
    throw analysisError ?? new Error("ai_analyses insert returned no row");
  }

  const analysisId = analysis.id;

  await supabase.from("insight_batches").update({ status: "processing" }).eq("id", batch.id);

  /** Record the failure against the analysis row, then unlock the batch. */
  async function fail(kind: AiFailureKind, detail: string) {
    await supabase
      .from("ai_analyses")
      .update({
        status: "failed",
        error_message: detail.slice(0, 2000),
        completed_at: new Date().toISOString(),
      })
      .eq("id", analysisId);

    await supabase.from("insight_batches").update({ status: "failed" }).eq("id", batchId);

    console.error("[api:analyzeInsights]", batchId, kind, detail);
    return apiError(kind === "rate_limit" ? 429 : 502, errorKeyFor(kind));
  }

  let completion: CompletionResult;
  try {
    const { images } = await loadBatchImages(batch.insight_images);

    completion = await withRetry(() =>
      provider.complete({
        systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
        prompt: buildExtractionPrompt({
          platform: batch.platform,
          imageCount: images.length,
          adminNotes: batch.notes,
        }),
        images,
        temperature: 0,
      })
    );
  } catch (cause) {
    if (cause instanceof AiProviderError) return fail(cause.kind, cause.message);
    return fail("unknown", String(cause));
  }

  const validated = parseModelJson(extractionResultSchema, completion.json);

  if (!validated.ok) {
    await supabase
      .from("ai_analyses")
      .update({ raw_response: completion.raw })
      .eq("id", analysis.id);
    return fail("bad_response", `Schema mismatch: ${validated.issues.join("; ")}`);
  }

  const extraction = prepareExtraction(validated.data, batch.platform);

  // Replace only this batch's AI rows. Manual corrections carry source
  // 'manual' and must survive a re-run (plan §19, §31).
  const { error: clearError } = await supabase
    .from("metrics")
    .delete()
    .eq("insight_batch_id", batch.id)
    .eq("source", "ai");

  if (clearError) return fail("unknown", `Could not clear prior AI metrics: ${clearError.message}`);

  if (extraction.metrics.length > 0) {
    const { error: insertError } = await supabase.from("metrics").insert(
      metricRowsFor({
        reportVersionId: batch.report_version_id,
        insightBatchId: batch.id,
        platform: batch.platform,
        metrics: extraction.metrics,
      }) as never
    );

    if (insertError) return fail("unknown", `Could not write metrics: ${insertError.message}`);
  }

  const summary = reviewSummary(extraction.metrics);

  await supabase
    .from("ai_analyses")
    .update({
      status: "completed",
      raw_response: completion.raw,
      structured_response: validated.data,
      completed_at: new Date().toISOString(),
    })
    .eq("id", analysis.id);

  // Always needs_review, even at full confidence: a human signs off before a
  // number reaches a client (plan §15, §30).
  await supabase.from("insight_batches").update({ status: "needs_review" }).eq("id", batch.id);

  await writeAuditLog(supabase, {
    actor_id: session.userId,
    action: "BATCH_ANALYZED",
    entity_type: "insight_batch",
    entity_id: batch.id,
    metadata: {
      platform: batch.platform,
      analysis_id: analysis.id,
      attempt: lastAttempt + 1,
      ...summary,
      discarded: extraction.discarded.length,
    },
  });

  return apiOk({
    batchId: batch.id,
    platform: batch.platform,
    status: "needs_review" as const,
    periodLabel: extraction.periodLabel,
    total: summary.total,
    needsReview: summary.needsReview,
    /** Count of nulls, distinct from the panel descriptions below. */
    unreadableCount: summary.unreadable,
    unreadable: extraction.unreadable,
  });
});
