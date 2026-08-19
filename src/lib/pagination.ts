import "server-only";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export type KeysetCursor = { value: string; id: string };

export function encodeCursor(cursor: KeysetCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | undefined): KeysetCursor | null {
  if (!raw || raw.length > 500) return null;
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as unknown;
    if (!value || typeof value !== "object") return null;
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.value !== "string" || typeof candidate.id !== "string") return null;
    if (candidate.value.length > 100 || candidate.id.length > 100) return null;
    return { value: candidate.value, id: candidate.id };
  } catch {
    return null;
  }
}

export function pageSize(raw: string | undefined, fallback = DEFAULT_PAGE_SIZE): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, MAX_PAGE_SIZE) : fallback;
}
