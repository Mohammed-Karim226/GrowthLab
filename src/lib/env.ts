/**
 * Centralised environment access.
 *
 * Server-only secrets are read through functions rather than module-level
 * constants so that importing this file from a client component cannot leak a
 * value at build time — the functions simply throw if reached in the browser.
 *
 * Supabase renamed its API keys: `anon` became the *publishable* key and
 * `service_role` became the *secret* key. Both schemes are accepted below,
 * classic name first, so an existing project keeps working and a new one can use
 * the names its dashboard actually shows.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`
    );
  }
  return value;
}

/**
 * First non-empty value among the accepted spellings.
 *
 * Values arrive already resolved rather than looked up by name, because a
 * computed `process.env[name]` is not substituted into the browser bundle. The
 * names ride along only to build a useful error message.
 */
function firstValue(names: string[], ...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value) return value;
  }
  return required(names.join(" or "), undefined);
}

function serverOnly(names: string[], ...values: Array<string | undefined>): string {
  if (typeof window !== "undefined") {
    throw new Error(`${names[0]} is server-only and must not be read in the browser.`);
  }
  return firstValue(names, ...values);
}

/**
 * Public Supabase URL — safe in the browser.
 *
 * The NEXT_PUBLIC_ reference must be written out literally: Next.js inlines
 * prefixed variables by textual substitution at build time, so a computed
 * `process.env[name]` lookup resolves to undefined in the browser bundle. The
 * unprefixed fallback therefore only ever helps server-side callers.
 */
export function supabaseUrl(): string {
  return firstValue(
    ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"],
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL
  );
}

/** Public anon/publishable key — safe in the browser, RLS still applies. */
export function supabaseAnonKey(): string {
  return firstValue(
    [
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
    ],
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY
  );
}

/** Bypasses RLS. Trusted server code only. */
export function supabaseServiceRoleKey(): string {
  return serverOnly(
    ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"],
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SECRET_KEY
  );
}

export function geminiApiKey(): string {
  return serverOnly(["GEMINI_API_KEY"], process.env.GEMINI_API_KEY);
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

// Upload limits are NOT here: the browser needs them, and nothing that runs in
// the browser may import this module. See lib/uploads.ts.
