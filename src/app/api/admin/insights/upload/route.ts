import { randomUUID } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk, notFound, withAdmin, writeAuditLog } from "@/lib/api";
import {
  ACCEPTED_IMAGE_TYPES,
  INSIGHTS_BUCKET,
  MAX_FILES_PER_REQUEST,
  MAX_UPLOAD_BYTES,
} from "@/lib/uploads";
import { PLATFORMS, type Platform } from "@/types/database";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Magic-number check. The browser-supplied MIME type is attacker-controlled,
 * so the bytes decide what actually gets stored.
 */
function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}

/**
 * Upload screenshots into a platform batch.
 *
 * Uploads are additive and idempotent-safe: every file gets a fresh UUID path,
 * so re-uploading never overwrites an earlier screenshot (plan §11, §12).
 */
export const POST = withAdmin("uploadInsights", async (session, request) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError(400, "invalidUpload");
  }

  const reportVersionId = String(form.get("reportVersionId") ?? "");
  const platformRaw = String(form.get("platform") ?? "");
  const notes = String(form.get("notes") ?? "").trim();

  if (!reportVersionId || !isPlatform(platformRaw)) {
    return apiError(422, "validationFailed");
  }
  const platform = platformRaw;

  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) return apiError(422, "noFiles");
  if (files.length > MAX_FILES_PER_REQUEST) return apiError(422, "tooManyFiles");

  const supabase = await createClient();

  // Resolve the version -> report -> client chain so the storage path is built
  // from verified server-side data, never from client input.
  const { data: version, error: versionError } = await supabase
    .from("report_versions")
    // FK named explicitly: two foreign keys join these tables, so an
    // unqualified `reports(...)` is ambiguous (PGRST201).
    .select("id, status, report_id, reports!report_versions_report_id_fkey(id, client_id)")
    .eq("id", reportVersionId)
    .maybeSingle<{
      id: string;
      status: string;
      report_id: string;
      reports: { id: string; client_id: string } | null;
    }>();

  if (versionError) throw versionError;
  if (!version || !version.reports) return notFound();

  // A published version is a historical record; corrections go to a new one.
  if (version.status === "published" || version.status === "archived") {
    return apiError(409, "versionLocked");
  }

  const clientId = version.reports.client_id;

  // Reuse the platform batch if it exists (one per platform per version).
  const { data: existingBatch, error: batchLookupError } = await supabase
    .from("insight_batches")
    .select("*")
    .eq("report_version_id", reportVersionId)
    .eq("platform", platform)
    .maybeSingle();

  if (batchLookupError) throw batchLookupError;

  let batch = existingBatch;

  if (!batch) {
    const { data: created, error: createError } = await supabase
      .from("insight_batches")
      .insert({
        report_version_id: reportVersionId,
        platform,
        status: "uploading",
        notes: notes || null,
      })
      .select("*")
      .single();

    if (createError || !created) throw createError ?? new Error("batch insert returned no row");
    batch = created;
  } else if (batch.status === "processing") {
    return apiError(409, "batchProcessing");
  }

  const { count: existingCount } = await supabase
    .from("insight_images")
    .select("id", { count: "exact", head: true })
    .eq("insight_batch_id", batch.id);

  const storage = createAdminClient().storage.from(INSIGHTS_BUCKET);
  const uploadedPaths: string[] = [];
  const rows: Array<Record<string, unknown>> = [];
  const rejected: Array<{ filename: string; reason: string }> = [];

  let sortOrder = existingCount ?? 0;

  for (const file of files) {
    if (file.size === 0) {
      rejected.push({ filename: file.name, reason: "empty" });
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      rejected.push({ filename: file.name, reason: "size" });
      continue;
    }
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      rejected.push({ filename: file.name, reason: "type" });
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sniffed = sniffMime(buffer);

    // Reject anything whose declared type and real bytes disagree.
    if (!sniffed || sniffed !== file.type) {
      rejected.push({ filename: file.name, reason: "type" });
      continue;
    }

    const imageId = randomUUID();
    const extension = EXTENSION_BY_MIME[sniffed];
    const path = `clients/${clientId}/reports/${version.report_id}/versions/${reportVersionId}/${platform}/${imageId}.${extension}`;

    const { error: uploadError } = await storage.upload(path, buffer, {
      contentType: sniffed,
      upsert: false, // paths are unique; never clobber an existing object
    });

    if (uploadError) {
      console.error("[api:uploadInsights:storage]", uploadError);
      rejected.push({ filename: file.name, reason: "storage" });
      continue;
    }

    uploadedPaths.push(path);
    rows.push({
      id: imageId,
      insight_batch_id: batch.id,
      storage_path: path,
      original_filename: file.name.slice(0, 255),
      mime_type: sniffed,
      file_size: file.size,
      sort_order: sortOrder++,
      uploaded_by: session.userId,
    });
  }

  if (rows.length === 0) {
    return apiError(422, "allFilesRejected", rejected.map((r) => `${r.filename}:${r.reason}`));
  }

  const { data: images, error: insertError } = await supabase
    .from("insight_images")
    .insert(rows as never)
    .select("*");

  if (insertError) {
    // Storage succeeded but the rows did not — remove the now-unreferenced
    // objects so the bucket does not accumulate orphans.
    await storage.remove(uploadedPaths);
    throw insertError;
  }

  await supabase
    .from("insight_batches")
    .update({ status: "uploaded", ...(notes ? { notes } : {}) })
    .eq("id", batch.id);

  await writeAuditLog(supabase, {
    actor_id: session.userId,
    action: "IMAGE_UPLOADED",
    entity_type: "insight_batch",
    entity_id: batch.id,
    metadata: { platform, uploaded: images?.length ?? 0, rejected: rejected.length },
  });

  return apiOk(
    {
      batch: { ...batch, status: "uploaded" as const },
      images,
      rejected,
    },
    201
  );
});
