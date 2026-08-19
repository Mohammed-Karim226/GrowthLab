import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk, notFound, withAdmin, writeAuditLog } from "@/lib/api";
import { INSIGHTS_BUCKET } from "@/lib/uploads";
import type { BatchStatus } from "@/types/database";

type Params = { params: Promise<{ imageId: string }> };

/** Statuses where the batch has not been handed to the AI yet. */
const REMOVABLE_BATCH_STATUSES: readonly BatchStatus[] = ["draft", "uploading", "uploaded"];

/**
 * Remove a screenshot before analysis.
 *
 * Only allowed while the batch is still being assembled — once analysis has run,
 * the extracted metrics reference the images that produced them, so deleting one
 * would leave numbers with no traceable source (plan §11).
 */
export const DELETE = withAdmin<[Params]>("deleteInsightImage", async (session, _request, { params }) => {
  const { imageId } = await params;
  const supabase = await createClient();

  const { data: image, error } = await supabase
    .from("insight_images")
    .select("id, storage_path, insight_batch_id, insight_batches(id, status)")
    .eq("id", imageId)
    .maybeSingle<{
      id: string;
      storage_path: string;
      insight_batch_id: string;
      insight_batches: { id: string; status: BatchStatus } | null;
    }>();

  if (error) throw error;
  if (!image || !image.insight_batches) return notFound();

  if (!REMOVABLE_BATCH_STATUSES.includes(image.insight_batches.status)) {
    return apiError(409, "batchLocked");
  }

  // Row first: an orphaned object is recoverable, a row pointing at a deleted
  // object is a broken preview for every future reader.
  const { error: deleteError } = await supabase.from("insight_images").delete().eq("id", imageId);
  if (deleteError) throw deleteError;

  const { error: storageError } = await createAdminClient()
    .storage.from(INSIGHTS_BUCKET)
    .remove([image.storage_path]);

  if (storageError) {
    // The row is gone, so the UI is already correct. Log for cleanup.
    console.error("[api:deleteInsightImage:storage]", storageError);
  }

  await writeAuditLog(supabase, {
    actor_id: session.userId,
    action: "IMAGE_DELETED",
    entity_type: "insight_batch",
    entity_id: image.insight_batch_id,
    metadata: { imageId },
  });

  return apiOk({ deleted: imageId });
});
