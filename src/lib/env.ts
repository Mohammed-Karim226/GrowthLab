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
  // gemini-3.5-flash is not a published Gemini model. Keep this valid by
  // default while still allowing deployments to pin another model.
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

export function sentryDsn(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || process.env.SENTRY_DSN?.trim() || undefined;
}

/** Local monitoring is opt-in; public switches are embedded during next build. */
export function sentryEnabled(): boolean {
  const enabled = process.env.NEXT_PUBLIC_SENTRY_ENABLED?.trim().toLowerCase();
  return Boolean(sentryDsn()) && enabled !== "false" && (enabled === "true" || process.env.NODE_ENV === "production");
}

export function sentryEnvironment(): string {
  return process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim()
    || process.env.SENTRY_ENVIRONMENT?.trim() || process.env.NODE_ENV || "development";
}

export function sentryRelease(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SENTRY_RELEASE?.trim() ||
    process.env.SENTRY_RELEASE?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA
  );
}

function sentryRate(fallback: number, ...values: Array<string | undefined>): number {
  const raw = values.find((value) => Boolean(value?.trim()));
  if (raw === undefined) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : fallback;
}

export function sentryTracesSampleRate(): number {
  return sentryRate(process.env.NODE_ENV === "production" ? 0.1 : 1,
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, process.env.SENTRY_TRACES_SAMPLE_RATE);
}

export function sentryReplaySessionSampleRate(): number {
  return sentryRate(0.05, process.env.NEXT_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE, process.env.SENTRY_REPLAY_SESSION_SAMPLE_RATE);
}

export function sentryReplayErrorSampleRate(): number {
  return sentryRate(1, process.env.NEXT_PUBLIC_SENTRY_REPLAY_ERROR_SAMPLE_RATE, process.env.SENTRY_REPLAY_ERROR_SAMPLE_RATE);
}

// Upload limits are NOT here: the browser needs them, and nothing that runs in
// the browser may import this module. See lib/uploads.ts.
