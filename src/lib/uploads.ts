/**
 * Upload limits shared by the browser and the server.
 *
 * Deliberately separate from lib/env.ts: that module holds the secret accessors,
 * and client components must never import it. These values are not secrets — the
 * private storage bucket enforces the same ceiling server-side, so this copy only
 * exists to reject obvious files before they leave the browser.
 *
 * NEXT_PUBLIC_ so both sides read the same number; a server-only variable would
 * be undefined in the client bundle and the two limits would silently diverge.
 */

const DEFAULT_MAX_UPLOAD_BYTES = 10_485_760; // 10 MB — matches the bucket policy.

function parsedLimit(): number {
  const raw = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_BYTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_UPLOAD_BYTES;
}

export const MAX_UPLOAD_BYTES = parsedLimit();

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const MAX_FILES_PER_REQUEST = 12;

export const INSIGHTS_BUCKET = "insights";
