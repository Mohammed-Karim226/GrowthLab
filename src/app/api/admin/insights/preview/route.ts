import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { apiError, apiOk, parseBody, withAdmin } from "@/lib/api";
import { INSIGHTS_BUCKET } from "@/lib/uploads";

const previewSchema = z
  .object({
    imageIds: z.array(z.string().uuid()).min(1).max(48),
  })
  .strict();

const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Short-lived signed URLs so an admin can review the screenshots they uploaded.
 *
 * The bucket stays private and no public URL is ever minted (plan §12). Reads go
 * through the caller's own session, so the storage policies — not this handler —
 * decide what may be signed; a five-minute TTL keeps a leaked link near-useless.
 */
export const POST = withAdmin("insightPreview", async (_session, request) => {
  const parsed = await parseBody(request, previewSchema);
  if (!parsed.ok) return parsed.response;

  const supabase = await createClient();

  const { data: images, error } = await supabase
    .from("insight_images")
    .select("id, storage_path")
    .in("id", parsed.data.imageIds);

  if (error) throw error;
  if (!images || images.length === 0) return apiError(404, "notFound");

  const { data: signed, error: signError } = await supabase.storage
    .from(INSIGHTS_BUCKET)
    .createSignedUrls(
      images.map((image) => image.storage_path),
      SIGNED_URL_TTL_SECONDS
    );

  if (signError) throw signError;

  const byPath = new Map((signed ?? []).map((entry) => [entry.path, entry.signedUrl]));

  return apiOk({
    urls: images.map((image) => ({
      imageId: image.id,
      url: byPath.get(image.storage_path) ?? null,
    })),
    expiresIn: SIGNED_URL_TTL_SECONDS,
  });
});
