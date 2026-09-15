const sensitive = /password|token|secret|credential|authorization|cookie|cipher|signed.?url/i;
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[OMITTED]";
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .map(([key, item]) => [key, sensitive.test(key) ? "[REDACTED]" : redact(item, depth + 1)]));
  return value;
}
export function errorCategory(error: unknown): string {
  const code = error && typeof error === "object" ? (error as { code?: unknown }).code : null;
  return typeof code === "string" && /^[A-Z0-9_]{2,32}$/.test(code) ? code : "operation_failed";
}
// Never accept arbitrary messages, URLs, request bodies, SQL details or provider text.
export function logEvent(event: {
  operation: string; outcome: string; requestId?: string; actorId?: string;
  tenantId?: string | null; entityId?: string; durationMs?: number; category?: string;
}) { console.info(JSON.stringify({ timestamp: new Date().toISOString(), ...event })); }
