import "server-only";

import { z } from "zod";
import { geminiModel, sentryDsn } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { isEncryptionConfigured } from "@/lib/security/secrets";
import { INSIGHTS_BUCKET } from "@/lib/uploads";
import type { AiJobRow } from "@/types/database";
import type { AiUsageSummary, ServiceHealth, ServiceId, SystemSnapshot } from "@/types/admin-system";

const CHECK_TIMEOUT_MS = 4_000;
const CACHE_MS = 30_000;
const MODEL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/;
const dashboards: Record<ServiceId, string | null> = {
  application: null,
  database: "https://supabase.com/dashboard",
  auth: "https://supabase.com/dashboard",
  storage: "https://supabase.com/dashboard",
  gemini: "https://aistudio.google.com/usage",
  inngest: "https://app.inngest.com",
  sentry: "https://sentry.io",
  credentials: null,
};

const count = z.number().int().nonnegative().safe();
const timestamp = z.string().datetime({ offset: true });
const usageSchema = z.object({
  since: timestamp,
  requests: count,
  succeeded: count,
  failed: count,
  rateLimited: count,
  tokens: count,
  tokenSamples: count,
  averageLatencyMs: z.number().finite().nonnegative().nullable(),
  models: z.array(z.object({
    model: z.string().regex(MODEL_NAME),
    requests: count,
    failed: count,
    tokens: count,
    tokenSamples: count,
    minuteRequests: count,
    minuteInputTokens: count,
    minuteTokenSamples: count,
    dayRequests: count,
  })).max(200),
  hourly: z.array(z.object({ hour: timestamp, requests: count, failed: count })).max(48),
});

class CheckTimeout extends Error {}
class CheckFailure extends Error {
  constructor(readonly detail: ServiceHealth["detail"], readonly status: ServiceHealth["status"] = "unavailable") {
    super(detail);
  }
}

/** The race also bounds stalled response-body reads; abort cancels the I/O. */
async function bounded<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new CheckTimeout());
    }, CHECK_TIMEOUT_MS);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => work(controller.signal)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function first(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => Boolean(value?.trim()))?.trim();
}

function health(id: ServiceId, status: ServiceHealth["status"], detail: ServiceHealth["detail"], check: ServiceHealth["check"] = "configuration", latencyMs: number | null = null): ServiceHealth {
  return { id, status, detail, check, latencyMs, dashboardUrl: dashboards[id] };
}

async function probe(id: ServiceId, work: (signal: AbortSignal) => Promise<ServiceHealth["detail"]>): Promise<ServiceHealth> {
  const started = Date.now();
  try {
    const detail = await bounded(work);
    return health(id, detail === "publicBucket" ? "degraded" : "operational", detail, "live", Date.now() - started);
  } catch (cause) {
    const timedOut = cause instanceof CheckTimeout || (cause instanceof Error && cause.name === "AbortError");
    return health(id, cause instanceof CheckFailure ? cause.status : "unavailable",
      timedOut ? "timedOut" : cause instanceof CheckFailure ? cause.detail : "checkFailed", "live", Date.now() - started);
  }
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function checkDatabaseError(error: unknown): void {
  if (error) throw new CheckFailure(errorCode(error) === "42501" ? "accessDenied" : "checkFailed");
}

async function readJson(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { method: "GET", headers, signal, cache: "no-store", redirect: "error" });
  if (!response.ok) {
    // Never parse or return provider error bodies: they can include credentials.
    void response.body?.cancel().catch(() => {});
    if (response.status === 429) throw new CheckFailure("rateLimited", "degraded");
    if (response.status === 401 || response.status === 403) throw new CheckFailure("accessDenied");
    throw new CheckFailure("checkFailed");
  }
  return response.json();
}

function serviceBase(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return parsed.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function quota(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function environment(): SystemSnapshot["environment"] {
  if (process.env.VERCEL_ENV === "preview") return "preview";
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

function sentryHealth(): ServiceHealth {
  const dsn = sentryDsn();
  if (!dsn) return health("sentry", "unconfigured", "missingConfig");
  try {
    const parsed = new URL(dsn);
    if (!["https:", "http:"].includes(parsed.protocol) || !parsed.username || parsed.password || !/\/\d+\/?$/.test(parsed.pathname)) throw new Error();
    return health("sentry", "configured", "configuredOnly");
  } catch {
    return health("sentry", "unconfigured", "invalidConfig");
  }
}

function configurationChecks(): ServiceHealth[] {
  const encryptionReady = isEncryptionConfigured();
  const development = process.env.NODE_ENV !== "production";
  const inngestReady = Boolean(first(process.env.INNGEST_EVENT_KEY) && first(process.env.INNGEST_SIGNING_KEY));
  const vaultPresent = Boolean(first(process.env.CREDENTIAL_ENCRYPTION_KEYS) && first(process.env.CREDENTIAL_ACTIVE_KEY_ID));
  return [
    health("inngest", development || inngestReady ? "configured" : "unconfigured", development ? "development" : inngestReady ? "configuredOnly" : "missingConfig"),
    sentryHealth(),
    health("credentials", encryptionReady ? "configured" : "unconfigured", encryptionReady ? "encryptionReady" : vaultPresent ? "invalidConfig" : "missingConfig"),
  ];
}

type Db = Awaited<ReturnType<typeof createClient>>;
type Jobs = NonNullable<SystemSnapshot["jobs"]>;
const safeJob = z.object({
  id: z.string().uuid(),
  status: z.enum(["queued", "processing", "completed", "failed", "dead_letter"]),
  created_at: timestamp,
  completed_at: timestamp.nullable(),
  error_key: z.string().nullable(),
});
const jobErrorKeys = new Set(["aiFailed", "aiRateLimited", "aiUnavailable", "aiBlocked", "aiBadResponse"]);

async function loadJobs(dbPromise: Promise<Db>, since: string): Promise<Jobs | null> {
  try {
    return await bounded(async (signal) => {
      const db = await dbPromise;
      const results = await Promise.all([
        db.from("ai_jobs").select("id", { count: "exact", head: true }).eq("status", "queued").abortSignal(signal),
        db.from("ai_jobs").select("id", { count: "exact", head: true }).eq("status", "processing").abortSignal(signal),
        db.from("ai_jobs").select("id", { count: "exact", head: true }).in("status", ["failed", "dead_letter"]).gte("completed_at", since).abortSignal(signal),
        db.from("ai_jobs").select("id, status, created_at, completed_at, error_key").order("created_at", { ascending: false }).limit(6).abortSignal(signal)
          .returns<Array<Pick<AiJobRow, "id" | "status" | "created_at" | "completed_at" | "error_key">>>(),
      ]);
      for (const result of results) checkDatabaseError(result.error);
      const counts = results.slice(0, 3).map((result) => count.parse(result.count));
      const recent = (results[3].data ?? []).flatMap((row) => {
        const parsed = safeJob.safeParse(row);
        if (!parsed.success) return [];
        const job = parsed.data;
        return [{ id: job.id, status: job.status, createdAt: job.created_at, completedAt: job.completed_at,
          errorKey: job.error_key && jobErrorKeys.has(job.error_key) ? job.error_key : null }];
      });
      return { queued: counts[0], running: counts[1], failed: counts[2], recent };
    });
  } catch {
    return null;
  }
}

async function loadUsage(dbPromise: Promise<Db>): Promise<Pick<SystemSnapshot, "usage" | "usageStatus">> {
  try {
    return await bounded(async (signal) => {
      const db = await dbPromise;
      const { data, error } = await db.rpc("admin_ai_usage_summary").abortSignal(signal);
      if (error) {
        const missing = ["PGRST202", "42883", "42P01"].includes(errorCode(error) ?? "");
        return { usage: null, usageStatus: missing ? "setup_required" : "unavailable" };
      }
      const parsed = usageSchema.safeParse(data);
      return parsed.success
        ? { usage: parsed.data satisfies AiUsageSummary, usageStatus: "available" }
        : { usage: null, usageStatus: "unavailable" };
    });
  } catch {
    return { usage: null, usageStatus: "unavailable" };
  }
}

async function buildSnapshot(): Promise<SystemSnapshot> {
  const checkedAt = new Date().toISOString();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
  const url = first(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL);
  const base = url ? serviceBase(url) : null;
  const anon = first(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, process.env.SUPABASE_PUBLISHABLE_KEY);
  const secret = first(process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY);
  const apiKey = first(process.env.GEMINI_API_KEY);
  const configuredModel = geminiModel();
  const validModel = MODEL_NAME.test(configuredModel);
  const model = validModel ? configuredModel : "unknown-model";
  // This promise exists only inside the authorized snapshot builder. Neither a
  // user's client nor their session is retained in the module cache.
  const db = base && anon ? createClient() : null;
  const missingDatabase = !url || !anon ? "missingConfig" : "invalidConfig";
  const missingStorage = !url || !secret ? "missingConfig" : "invalidConfig";

  const [database, auth, storage, gemini, jobs, usage] = await Promise.all([
    db ? probe("database", async (signal) => {
      const { error } = await (await db).from("clients").select("id", { head: true }).limit(1).abortSignal(signal);
      checkDatabaseError(error);
      return "responding";
    }) : Promise.resolve(health("database", "unconfigured", missingDatabase)),
    base && anon ? probe("auth", async (signal) => {
      await readJson(`${base}/auth/v1/health`, { apikey: anon }, signal);
      return "reachable";
    }) : Promise.resolve(health("auth", "unconfigured", missingDatabase)),
    base && secret ? probe("storage", async (signal) => {
      const body = await readJson(`${base}/storage/v1/bucket/${INSIGHTS_BUCKET}`, { apikey: secret, Authorization: `Bearer ${secret}` }, signal);
      const bucket = z.object({ id: z.literal(INSIGHTS_BUCKET), public: z.boolean() }).safeParse(body);
      if (!bucket.success) throw new CheckFailure("checkFailed");
      return bucket.data.public ? "publicBucket" : "privateBucket";
    }) : Promise.resolve(health("storage", "unconfigured", missingStorage)),
    apiKey && validModel ? probe("gemini", async (signal) => {
      const body = await readJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(configuredModel)}`, { "x-goog-api-key": apiKey }, signal);
      const metadata = z.object({ supportedGenerationMethods: z.array(z.string()) }).safeParse(body);
      if (!metadata.success || !metadata.data.supportedGenerationMethods.includes("generateContent")) throw new CheckFailure("checkFailed");
      return "modelAvailable";
    }) : Promise.resolve(health("gemini", "unconfigured", !apiKey ? "missingConfig" : "invalidConfig")),
    db ? loadJobs(db, since) : Promise.resolve(null),
    db ? loadUsage(db) : Promise.resolve({ usage: null, usageStatus: "unavailable" as const }),
  ]);

  const models = [model, ...(usage.usage?.models.map((entry) => entry.model).filter((name) => name !== model) ?? [])];
  return {
    checkedAt, environment: environment(),
    services: [health("application", "operational", "responding", "live"), database, auth, storage, gemini, ...configurationChecks()],
    ...usage,
    quotas: models.map((name) => ({
      model: name, active: name === model,
      requestsPerMinute: name === model && validModel ? quota(process.env.GEMINI_QUOTA_RPM) : null,
      inputTokensPerMinute: name === model && validModel ? quota(process.env.GEMINI_QUOTA_TPM) : null,
      requestsPerDay: name === model && validModel ? quota(process.env.GEMINI_QUOTA_RPD) : null,
    })),
    jobs,
  };
}

let cached: { value: SystemSnapshot; expiresAt: number } | undefined;
let inFlight: Promise<SystemSnapshot> | undefined;

/** Call only after requireAdmin/withAdmin. Cache contains aggregate data only. */
export async function getSystemSnapshot(): Promise<SystemSnapshot> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (inFlight) return inFlight;
  inFlight = buildSnapshot().then((value) => {
    cached = { value, expiresAt: Date.now() + CACHE_MS };
    return value;
  }).finally(() => { inFlight = undefined; });
  return inFlight;
}
