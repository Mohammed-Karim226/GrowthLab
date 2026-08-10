import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { INSIGHTS_BUCKET } from "@/lib/uploads";
import type { Platform } from "@/types/database";
import type { VisionImage } from "./provider";
import { AiProviderError } from "./provider";

/**
 * Screenshot loading for the vision call.
 *
 * Bytes are fetched with the service-role client because the caller's
 * authorisation was already settled by the route: it resolved the batch through
 * RLS before we got here. This module only ever sees paths that check passed.
 */

/**
 * Ceiling on one request's inline image payload.
 *
 * Gemini accepts roughly 20 MB of inline data per request, and base64 inflates
 * bytes by about a third. 12 MB of raw screenshots is the practical limit.
 */
const MAX_INLINE_TOTAL_BYTES = 12 * 1024 * 1024;

export type LoadedImages = {
  images: VisionImage[];
  totalBytes: number;
};

export type StoredImage = {
  id: string;
  storage_path: string;
  mime_type: string | null;
  sort_order: number;
};

/**
 * Download a batch's screenshots as base64, in display order.
 *
 * Refuses the whole batch rather than sending a subset: dropping screenshots
 * would produce a confident-looking extraction that quietly missed metrics.
 */
export async function loadBatchImages(images: StoredImage[]): Promise<LoadedImages> {
  const storage = createAdminClient().storage.from(INSIGHTS_BUCKET);
  const ordered = [...images].sort((a, b) => a.sort_order - b.sort_order);

  const loaded: VisionImage[] = [];
  let totalBytes = 0;

  for (const image of ordered) {
    const { data, error } = await storage.download(image.storage_path);

    if (error || !data) {
      throw new AiProviderError(
        "unknown",
        `Could not read screenshot ${image.id} from storage: ${error?.message ?? "no body"}`
      );
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    totalBytes += buffer.byteLength;

    if (totalBytes > MAX_INLINE_TOTAL_BYTES) {
      throw new AiProviderError(
        "bad_response",
        `Batch exceeds the ${MAX_INLINE_TOTAL_BYTES} byte inline limit for one analysis request`
      );
    }

    loaded.push({
      mimeType: image.mime_type ?? data.type ?? "image/png",
      data: buffer.toString("base64"),
    });
  }

  return { images: loaded, totalBytes };
}

/** Rows for one batch's extraction, ready for `metrics.insert`. */
export function metricRowsFor(input: {
  reportVersionId: string;
  insightBatchId: string;
  platform: Platform;
  metrics: Array<{
    metric_name: string;
    metric_value: number | null;
    metric_unit: string;
    confidence: number;
    needs_review: boolean;
    note: string | null;
  }>;
}) {
  return input.metrics.map((metric) => ({
    report_version_id: input.reportVersionId,
    insight_batch_id: input.insightBatchId,
    platform: input.platform,
    metric_name: metric.metric_name,
    metric_value: metric.metric_value,
    metric_unit: metric.metric_unit,
    // metric_date stays null: the period lives on the report, and a date
    // inferred from a screenshot label would be a guess (plan §16).
    metric_date: null,
    source: "ai" as const,
    confidence: metric.confidence,
    needs_review: metric.needs_review,
    note: metric.note,
  }));
}
