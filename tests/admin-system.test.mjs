import assert from "node:assert/strict";
import { test } from "node:test";
import { appLoader } from "./helpers/app-loader.mjs";

const actorId = "33a45d0d-366a-424d-819d-b20b5a228697";
const jobId = "ea30d44e-3217-4dc7-bb27-f278aa41780d";
const sensitiveValue = "private-provider-key-must-not-be-exposed";
const environmentNames = [
  "NODE_ENV", "VERCEL_ENV", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "GEMINI_API_KEY", "GEMINI_MODEL",
  "GEMINI_QUOTA_RPM", "GEMINI_QUOTA_TPM", "GEMINI_QUOTA_RPD", "INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY",
  "NEXT_PUBLIC_SENTRY_DSN", "SENTRY_DSN", "CREDENTIAL_ENCRYPTION_KEYS", "CREDENTIAL_ACTIVE_KEY_ID",
];

function configure(t, patch = {}) {
  const previous = Object.fromEntries(environmentNames.map((name) => [name, process.env[name]]));
  for (const name of environmentNames) delete process.env[name];
  Object.assign(process.env, {
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-key",
    SUPABASE_SERVICE_ROLE_KEY: sensitiveValue,
    GEMINI_API_KEY: sensitiveValue,
    GEMINI_MODEL: "gemini-2.5-flash",
    GEMINI_QUOTA_RPM: "20", GEMINI_QUOTA_TPM: "1000", GEMINI_QUOTA_RPD: "500",
    INNGEST_EVENT_KEY: sensitiveValue, INNGEST_SIGNING_KEY: sensitiveValue,
    NEXT_PUBLIC_SENTRY_DSN: "https://public-key@sentry.invalid/123",
    CREDENTIAL_ENCRYPTION_KEYS: "test-keyring", CREDENTIAL_ACTIVE_KEY_ID: "test-key",
  });
  for (const [name, value] of Object.entries(patch)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

function usage() {
  return {
    since: new Date(Date.now() - 86_400_000).toISOString(),
    requests: 4, succeeded: 3, failed: 1, rateLimited: 1, tokens: 123, tokenSamples: 3, averageLatencyMs: 42,
    models: [
      { model: "gemini-2.5-flash", requests: 3, failed: 1, tokens: 100, tokenSamples: 2, minuteRequests: 2, minuteInputTokens: 25, minuteTokenSamples: 1, dayRequests: 3 },
      { model: "gemini-previous", requests: 1, failed: 0, tokens: 23, tokenSamples: 1, minuteRequests: 0, minuteInputTokens: 0, minuteTokenSamples: 0, dayRequests: 1 },
    ],
    hourly: [{ hour: new Date().toISOString(), requests: 4, failed: 1 }],
  };
}

function scenario(t, options = {}) {
  configure(t, options.env);
  const state = { role: "admin", usage: usage(), vaultReady: true, ...options, authChecks: 0, reads: [], rpcCalls: 0, fetches: [] };
  const db = {
    auth: { async getUser() {
      state.authChecks++;
      return { data: { user: state.role ? { id: actorId } : null }, error: null };
    } },
    from(table) {
      const read = { table, filters: [], columns: null };
      const query = {
        select(columns, settings) { read.columns = columns; read.settings = settings; return query; },
        eq(...args) { read.filters.push(["eq", ...args]); return query; },
        in(...args) { read.filters.push(["in", ...args]); return query; },
        gte(...args) { read.filters.push(["gte", ...args]); return query; },
        limit(value) { read.limit = value; return query; },
        order(...args) { read.order = args; return query; },
        abortSignal(signal) { read.signal = signal; return query; },
        returns() { return query; },
        async maybeSingle() {
          assert.equal(table, "profiles");
          return { data: { id: actorId, role: state.role, client_id: null }, error: null };
        },
        then(resolve, reject) {
          state.reads.push(read);
          let result;
          if (state.dbError) result = { data: null, count: null, error: state.dbError };
          else if (table === "clients") result = { data: null, error: null };
          else {
            assert.equal(table, "ai_jobs");
            const status = read.filters.find((item) => item[0] === "eq")?.[2];
            result = read.settings?.head
              ? { data: null, count: status === "queued" ? 2 : status === "processing" ? 1 : 3, error: null }
              : { data: [{ id: jobId, status: "dead_letter", created_at: new Date().toISOString(), completed_at: new Date().toISOString(), error_key: state.jobErrorKey ?? "aiFailed", error_detail: sensitiveValue }], error: null };
          }
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return query;
    },
    rpc(name) {
      assert.equal(name, "admin_ai_usage_summary");
      state.rpcCalls++;
      return {
        abortSignal() { return this; },
        then(resolve, reject) { return Promise.resolve({ data: state.usage, error: state.rpcError ?? state.dbError ?? null }).then(resolve, reject); },
      };
    },
  };
  t.mock.method(globalThis, "fetch", async (url, init) => {
    state.fetches.push({ url, init });
    assert.equal(init.method, "GET", "Health checks must never generate content or write data");
    assert.equal(init.cache, "no-store");
    assert.equal(init.redirect, "error", "Credentials must not follow redirects");
    assert.ok(!url.includes(sensitiveValue));
    if (url.includes("generativelanguage")) {
      assert.ok(!url.includes(":generateContent"));
      assert.equal(init.headers["x-goog-api-key"], sensitiveValue);
      if (state.hangBody) return { ok: true, json: () => new Promise(() => {}) };
      if (state.geminiStatus) return new Response(sensitiveValue, { status: state.geminiStatus });
      return Response.json({ name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] });
    }
    if (url.endsWith("/auth/v1/health")) return Response.json({ version: "test" });
    assert.ok(url.endsWith("/storage/v1/bucket/insights"));
    assert.equal(init.headers.apikey, sensitiveValue);
    return Response.json({ id: "insights", public: state.publicBucket ?? false });
  });
  const load = appLoader({
    "@/lib/supabase/server": { createClient: async () => db },
    "@/lib/security/secrets": { isEncryptionConfigured: () => state.vaultReady },
    "@/lib/security/logging": { logEvent() {}, errorCategory: () => "operation_failed", redact: (value) => value },
  });
  return {
    state,
    request: () => load("src/app/api/admin/system/route.ts").GET(new Request("http://localhost/api/admin/system")),
  };
}

for (const role of [null, "client"]) {
  test(`system health rejects ${role ?? "anonymous"} before any integration probe`, async (t) => {
    const { state, request } = scenario(t, { role });
    assert.equal((await request()).status, 401);
    assert.equal(state.rpcCalls, 0);
    assert.equal(state.fetches.length, 0);
    assert.equal(state.reads.length, 0);
  });
}

test("admin sees read-only health, tracked usage and separate historical-model budgets", async (t) => {
  const { state, request } = scenario(t);
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const snapshot = await response.json();
  assert.equal(snapshot.services.length, 8);
  assert.equal(snapshot.services.find((item) => item.id === "application").latencyMs, null);
  assert.equal(snapshot.services.find((item) => item.id === "gemini").detail, "modelAvailable");
  assert.equal(snapshot.services.find((item) => item.id === "storage").detail, "privateBucket");
  for (const id of ["inngest", "sentry", "credentials"]) {
    assert.equal(snapshot.services.find((item) => item.id === id).check, "configuration");
    assert.equal(snapshot.services.find((item) => item.id === id).status, "configured");
  }
  assert.equal(snapshot.usageStatus, "available");
  assert.equal(snapshot.usage.requests, 4);
  assert.equal(snapshot.usage.models[0].minuteInputTokens, 25);
  assert.deepEqual(snapshot.quotas[0], { model: "gemini-2.5-flash", active: true, requestsPerMinute: 20, inputTokensPerMinute: 1000, requestsPerDay: 500 });
  assert.deepEqual(snapshot.quotas[1], { model: "gemini-previous", active: false, requestsPerMinute: null, inputTokensPerMinute: null, requestsPerDay: null });
  assert.equal(snapshot.jobs.queued, 2);
  assert.equal(snapshot.jobs.running, 1);
  assert.equal(snapshot.jobs.failed, 3);
  assert.equal(snapshot.jobs.recent[0].errorKey, "aiFailed");
  assert.equal(state.fetches.length, 3);
  const recentRead = state.reads.find((read) => read.table === "ai_jobs" && !read.settings?.head);
  assert.equal(recentRead.limit, 6);
  assert.ok(!recentRead.columns.includes("error_detail"));
  assert.ok(!JSON.stringify(snapshot).includes(sensitiveValue));
});

test("snapshot coalesces concurrent checks but authorizes every request including cached responses", async (t) => {
  const { state, request } = scenario(t);
  const first = await Promise.all([request(), request()]);
  assert.deepEqual(await first[0].json(), await first[1].json());
  assert.equal(state.authChecks, 2);
  assert.equal(state.rpcCalls, 1);
  assert.equal(state.fetches.length, 3);
  assert.equal((await request()).status, 200);
  assert.equal(state.authChecks, 3);
  assert.equal(state.rpcCalls, 1);
  state.role = "client";
  assert.equal((await request()).status, 401);
  assert.equal(state.authChecks, 4);
  assert.equal(state.rpcCalls, 1);
});

test("a stalled provider response body times out while independent checks remain available", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { state, request } = scenario(t, { hangBody: true });
  const pending = request();
  await new Promise((resolve) => setImmediate(resolve));
  t.mock.timers.tick(4_001);
  const snapshot = await (await pending).json();
  const gemini = snapshot.services.find((item) => item.id === "gemini");
  assert.equal(gemini.status, "unavailable");
  assert.equal(gemini.detail, "timedOut");
  assert.ok(state.fetches.find((item) => item.url.includes("generativelanguage")).init.signal.aborted);
  assert.equal(snapshot.services.find((item) => item.id === "storage").status, "operational");
  assert.equal(snapshot.usageStatus, "available");
});

for (const code of ["PGRST202", "42883", "42P01"]) {
  test(`missing usage RPC or table (${code}) requires setup rather than inventing zero consumption`, async (t) => {
    const { request } = scenario(t, { rpcError: { code, message: sensitiveValue } });
    const snapshot = await (await request()).json();
    assert.equal(snapshot.usageStatus, "setup_required");
    assert.equal(snapshot.usage, null);
    assert.equal(snapshot.jobs.queued, 2);
    assert.ok(!JSON.stringify(snapshot).includes(sensitiveValue));
  });
}

test("database failure leaves usage and queue unavailable, without exposing error details", async (t) => {
  const { request } = scenario(t, { dbError: { code: "08006", message: sensitiveValue } });
  const snapshot = await (await request()).json();
  assert.equal(snapshot.usageStatus, "unavailable");
  assert.equal(snapshot.usage, null);
  assert.equal(snapshot.jobs, null);
  assert.equal(snapshot.services.find((item) => item.id === "database").status, "unavailable");
  assert.ok(!JSON.stringify(snapshot).includes(sensitiveValue));
});

for (const [status, detail] of [[429, "rateLimited"], [403, "accessDenied"], [500, "checkFailed"]]) {
  test(`provider HTTP ${status} produces a safe status code`, async (t) => {
    const { request } = scenario(t, { geminiStatus: status, jobErrorKey: sensitiveValue });
    const snapshot = await (await request()).json();
    assert.equal(snapshot.services.find((item) => item.id === "gemini").detail, detail);
    assert.equal(snapshot.jobs.recent[0].errorKey, null);
    assert.ok(!JSON.stringify(snapshot).includes(sensitiveValue));
  });
}

test("missing integration credentials and invalid budgets are shown as unknown, not zero", async (t) => {
  const { state, request } = scenario(t, { vaultReady: false, env: {
    GEMINI_API_KEY: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined, INNGEST_EVENT_KEY: undefined,
    NEXT_PUBLIC_SENTRY_DSN: undefined, CREDENTIAL_ENCRYPTION_KEYS: undefined,
    GEMINI_QUOTA_RPM: "0", GEMINI_QUOTA_TPM: "1.5", GEMINI_QUOTA_RPD: "-5",
  } });
  const snapshot = await (await request()).json();
  for (const id of ["gemini", "storage", "inngest", "sentry", "credentials"]) {
    assert.equal(snapshot.services.find((item) => item.id === id).status, "unconfigured");
  }
  assert.deepEqual(snapshot.quotas[0], { model: "gemini-2.5-flash", active: true, requestsPerMinute: null, inputTokensPerMinute: null, requestsPerDay: null });
  assert.equal(state.fetches.length, 1);
});

test("credential-bearing service URLs never reach a fetch or appear in the response", async (t) => {
  const { state, request } = scenario(t, { env: {
    NEXT_PUBLIC_SUPABASE_URL: `https://user:${sensitiveValue}@project.supabase.invalid`,
    GEMINI_MODEL: `https://invalid/${sensitiveValue}?key=secret`,
  } });
  const snapshot = await (await request()).json();
  assert.equal(snapshot.services.find((item) => item.id === "database").detail, "invalidConfig");
  assert.equal(snapshot.services.find((item) => item.id === "gemini").detail, "invalidConfig");
  assert.equal(snapshot.usage, null);
  assert.equal(snapshot.quotas[0].model, "unknown-model");
  assert.equal(state.fetches.length, 0);
  assert.ok(!JSON.stringify(snapshot).includes(sensitiveValue));
});

test("an unexpectedly public insights bucket is degraded", async (t) => {
  const { request } = scenario(t, { publicBucket: true });
  const snapshot = await (await request()).json();
  const storage = snapshot.services.find((item) => item.id === "storage");
  assert.equal(storage.status, "degraded");
  assert.equal(storage.detail, "publicBucket");
});

test("invalid usage payloads are unavailable and arbitrary payload fields never escape", async (t) => {
  const { request } = scenario(t, { usage: { ...usage(), tokens: null, privateError: sensitiveValue } });
  const snapshot = await (await request()).json();
  assert.equal(snapshot.usageStatus, "unavailable");
  assert.equal(snapshot.usage, null);
  assert.ok(!JSON.stringify(snapshot).includes(sensitiveValue));
});
