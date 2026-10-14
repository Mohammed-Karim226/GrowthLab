import assert from "node:assert/strict";
import { test } from "node:test";
import { appLoader } from "./helpers/app-loader.mjs";

const userId = "33a45d0d-366a-424d-819d-b20b5a228697";
const requestId = "976e0219-3647-460a-8418-fbc305fc86aa";
const jobId = "ea30d44e-3217-4dc7-bb27-f278aa41780d";
const secret = "private.provider@example.invalid?token=never-send-this";
const envNames = [
  "NODE_ENV", "NEXT_PUBLIC_SENTRY_DSN", "SENTRY_DSN", "NEXT_PUBLIC_SENTRY_ENABLED",
  "NEXT_PUBLIC_SENTRY_ENVIRONMENT", "SENTRY_ENVIRONMENT", "NEXT_PUBLIC_SENTRY_RELEASE", "SENTRY_RELEASE",
  "NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE", "SENTRY_TRACES_SAMPLE_RATE",
  "NEXT_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE", "SENTRY_REPLAY_SESSION_SAMPLE_RATE",
  "NEXT_PUBLIC_SENTRY_REPLAY_ERROR_SAMPLE_RATE", "SENTRY_REPLAY_ERROR_SAMPLE_RATE",
  "NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA", "VERCEL_GIT_COMMIT_SHA",
];

function configure(t, values = {}) {
  const previous = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  envNames.forEach((name) => delete process.env[name]);
  Object.assign(process.env, values);
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

function captureBoundary(overrides = {}) {
  const state = { events: [], init: [], flushes: [], replays: [] };
  let current;
  const sdk = {
    withScope(work) {
      current = {};
      work({
        setLevel(level) { current.level = level; },
        setTags(tags) { current.tags = tags; },
        setContext(name, data) { current.contexts = { ...current.contexts, [name]: data }; },
        setFingerprint(fingerprint) { current.fingerprint = fingerprint; },
      });
    },
    captureException(error) {
      state.events.push({ error, ...current });
      return `event-${state.events.length}`;
    },
    async flush(timeout) { state.flushes.push(timeout); return true; },
    init(options) { state.init.push(options); },
    replayIntegration(options) { state.replays.push(options); return { name: "Replay" }; },
    captureRouterTransitionStart() {},
    ...overrides,
  };
  return { state, sdk };
}

test("monitoring is disabled without a DSN and local recording is explicit opt-in", (t) => {
  configure(t, { NODE_ENV: "production" });
  const env = appLoader()("src/lib/env.ts");
  assert.equal(env.sentryEnabled(), false);
  process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@sentry.invalid/1";
  assert.equal(env.sentryEnabled(), true);
  process.env.NEXT_PUBLIC_SENTRY_ENABLED = "false";
  assert.equal(env.sentryEnabled(), false);
  process.env.NODE_ENV = "development";
  delete process.env.NEXT_PUBLIC_SENTRY_ENABLED;
  assert.equal(env.sentryEnabled(), false);
  process.env.NEXT_PUBLIC_SENTRY_ENABLED = "true";
  assert.equal(env.sentryEnabled(), true);
});

test("public settings take precedence and blank sampling settings retain defaults", (t) => {
  configure(t, {
    NODE_ENV: "production", NEXT_PUBLIC_SENTRY_ENVIRONMENT: "staging", SENTRY_ENVIRONMENT: "private-server",
    NEXT_PUBLIC_SENTRY_RELEASE: "release-a", SENTRY_RELEASE: "release-b",
    NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: "0.25", SENTRY_TRACES_SAMPLE_RATE: "0.9",
    NEXT_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE: "0", NEXT_PUBLIC_SENTRY_REPLAY_ERROR_SAMPLE_RATE: " ",
  });
  const env = appLoader()("src/lib/env.ts");
  assert.equal(env.sentryEnvironment(), "staging");
  assert.equal(env.sentryRelease(), "release-a");
  assert.equal(env.sentryTracesSampleRate(), 0.25);
  assert.equal(env.sentryReplaySessionSampleRate(), 0);
  assert.equal(env.sentryReplayErrorSampleRate(), 1);
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE = "";
  process.env.SENTRY_TRACES_SAMPLE_RATE = "";
  assert.equal(env.sentryTracesSampleRate(), 0.1);
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE = "invalid";
  assert.equal(env.sentryTracesSampleRate(), 0.1);
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE = "20";
  assert.equal(env.sentryTracesSampleRate(), 1);
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE = "-2";
  assert.equal(env.sentryTracesSampleRate(), 0);
});

test("browser, Node and Edge initialize the same privacy policy without live transport", (t) => {
  configure(t, { NODE_ENV: "production", NEXT_PUBLIC_SENTRY_DSN: "https://public@sentry.invalid/1" });
  const { state, sdk } = captureBoundary();
  const load = appLoader({ "@sentry/nextjs": sdk });
  for (const filename of ["src/instrumentation-client.ts", "sentry.server.config.ts", "sentry.edge.config.ts"]) load(filename);
  assert.equal(state.init.length, 3);
  const shared = load("src/lib/observability/sentry-options.ts");
  for (const options of state.init) {
    assert.equal(options.enabled, true);
    assert.equal(options.sendDefaultPii, false);
    assert.equal(options.beforeSend, shared.sanitizeSentryEvent);
    assert.equal(options.beforeSendTransaction, shared.sanitizeSentryEvent);
    assert.equal(options.beforeBreadcrumb, shared.sanitizeSentryBreadcrumb);
  }
  const replay = state.replays[0];
  assert.equal(replay.maskAllText, true);
  assert.equal(replay.maskAllInputs, true);
  assert.equal(replay.blockAllMedia, true);
  assert.equal(replay.networkCaptureBodies, false);
  assert.deepEqual(replay.networkDetailAllowUrls, []);
  assert.equal(replay.beforeAddRecordingEvent({ data: { tag: "breadcrumb", payload: { message: secret } } }), null);
  assert.equal(replay.beforeAddRecordingEvent({ data: { tag: "performanceSpan", payload: { description: secret } } }), null);
  assert.deepEqual(state.events, []);
});

test("automatic errors keep source positions and opaque identifiers without payloads or secrets", () => {
  const { sanitizeSentryEvent } = appLoader()("src/lib/observability/sentry-options.ts");
  const event = sanitizeSentryEvent({
    type: undefined,
    event_id: "a".repeat(32), message: secret,
    user: { id: userId, email: secret, ip_address: "192.0.2.1" },
    request: { method: "POST", url: `https://user:password@example.invalid/path?${secret}`, data: secret, headers: { Authorization: secret, Cookie: secret } },
    extra: { response: secret }, server_name: secret, logentry: { message: secret },
    tags: { operation: "createReport", category: "database_error", unsafe: secret },
    fingerprint: ["{{ default }}", "createReport", secret],
    contexts: { application: { requestId, actorId: userId, jobId: secret, response: secret }, arbitrary: { data: secret }, trace: { trace_id: "a".repeat(32), span_id: "b".repeat(16), data: { body: secret }, op: "http.server" } },
    exception: { values: [{ type: "TypeError", value: secret, mechanism: { type: "generic", handled: false, data: { raw: secret } }, stacktrace: { frames: [{ filename: "C:\\Users\\private-user\\app\\.next\\server\\app.js", abs_path: "C:\\Users\\private-user\\app\\.next\\server\\app.js", function: "createReport", lineno: 42, colno: 8, context_line: secret, vars: { password: secret }, debug_id: requestId }] } }] },
    debug_meta: { images: [{ type: "sourcemap", code_file: "C:\\Users\\private-user\\app\\.next\\server\\app.js", debug_id: requestId }] },
    breadcrumbs: [{ category: "console", message: secret, data: { arguments: [secret] } }, { category: "fetch", message: secret, data: { method: "POST", status_code: 500, url: secret, body: secret } }],
  });
  const serialized = JSON.stringify(event);
  assert.ok(!serialized.includes(secret));
  assert.ok(!serialized.includes("private-user"));
  assert.ok(!serialized.includes("Authorization"));
  assert.equal(event.exception.values[0].value, "Application operation failed");
  assert.equal(event.exception.values[0].type, "TypeError");
  assert.equal(event.exception.values[0].stacktrace.frames[0].filename, ".next/server/app.js");
  assert.equal(event.exception.values[0].stacktrace.frames[0].lineno, 42);
  assert.equal(event.exception.values[0].stacktrace.frames[0].abs_path, event.debug_meta.images[0].code_file);
  assert.equal(event.debug_meta.images[0].debug_id, requestId);
  assert.deepEqual(event.tags, { operation: "createReport", category: "database_error" });
  assert.deepEqual(event.contexts.application, { requestId, actorId: userId });
  assert.deepEqual(event.breadcrumbs[0].data, { method: "POST", status_code: 500 });
});

test("traces retain timings and route templates while removing SQL, URL credentials and custom attributes", () => {
  const { sanitizeSentryEvent } = appLoader()("src/lib/observability/sentry-options.ts");
  const input = {
    type: "transaction", transaction: "POST /api/admin/clients/[clientId]", transaction_info: { source: "route" },
    spans: [{ trace_id: "a".repeat(32), span_id: "b".repeat(16), start_timestamp: 1, timestamp: 2, op: "db.query", description: `SELECT '${secret}'`, data: { "db.statement": secret, "http.url": secret } }],
  };
  const event = sanitizeSentryEvent(input);
  assert.equal(event.transaction, "POST /api/admin/clients/[clientId]");
  assert.deepEqual(event.spans[0].data, {});
  assert.equal(event.spans[0].start_timestamp, 1);
  assert.equal(event.spans[0].timestamp, 2);
  assert.ok(!JSON.stringify(event).includes(secret));
  assert.equal(sanitizeSentryEvent({ type: "transaction", transaction: `GET /users/${secret}`, transaction_info: { source: "url" } }).transaction, "application.request");
});

test("handled errors remove provider text, deduplicate one failure and preserve request correlation", () => {
  const { state, sdk } = captureBoundary();
  const { reportError } = appLoader({ "@sentry/nextjs": sdk })("src/lib/observability/report-error.ts");
  const cause = Object.assign(new Error(secret), { code: "ECONNRESET" });
  cause.stack = `Error: ${secret}\n    at createReport (/app/src/lib/api.ts:30:8)`;
  const context = { operation: "createReport", requestId, actorId: userId, tenantId: secret };
  assert.equal(reportError(cause, context), "event-1");
  assert.equal(reportError(cause, context), "event-1");
  assert.equal(state.events.length, 1);
  const event = state.events[0];
  assert.equal(event.error.message, "Application operation failed");
  assert.ok(event.error.stack.includes("src/lib/api.ts:30:8"));
  assert.ok(!event.error.stack.includes(secret));
  assert.deepEqual(event.tags, { operation: "createReport", category: "connection_failed" });
  assert.deepEqual(event.contexts.application, { requestId, actorId: userId });
  reportError(cause, { ...context, requestId: jobId });
  assert.equal(state.events.length, 2);
});

test("SDK exceptions and flush failures never escape into application work", async () => {
  const { sdk } = captureBoundary({ captureException() { throw new Error("transport failed"); }, flush() { throw new Error("flush failed"); } });
  const { reportError, flushErrors } = appLoader({ "@sentry/nextjs": sdk })("src/lib/observability/report-error.ts");
  assert.equal(reportError(new Error(secret), { operation: "test" }), undefined);
  await assert.doesNotReject(flushErrors);
});

function apiScenario(t, options = {}) {
  const capture = captureBoundary(options.sdk);
  t.mock.method(console, "info", () => {});
  const load = appLoader({
    "@sentry/nextjs": capture.sdk,
    "@/lib/auth": { async requireAdminApi() {
      if (options.authError) throw options.authError;
      return options.denied ? null : { userId, profile: { client_id: null } };
    } },
  });
  return { ...capture, api: load("src/lib/api.ts") };
}

test("unexpected admin API failures preserve safe responses and correlate to an error event", async (t) => {
  const { api, state } = apiScenario(t);
  const route = api.withAdmin("createReport", async () => { throw new Error(secret); });
  const response = await route(new Request("https://example.invalid/api/admin/reports"));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { errorKey: "serverError" });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].contexts.application.requestId, response.headers.get("x-request-id"));
  assert.equal(state.events[0].contexts.application.actorId, userId);
  assert.equal(state.events[0].error.message, "Application operation failed");
});

test("expected validation, authorization, conflicts and Sentry polling errors do not create issue noise", async (t) => {
  const { api, state } = apiScenario(t);
  assert.equal(api.serverError("publishReport", { code: "23505", message: secret }).status, 409);
  assert.equal(api.serverError("sentryIssues", new Error(secret)).status, 500);
  const route = api.withAdmin("createReport", async () => api.apiError(422, "validationFailed"));
  assert.equal((await route(new Request("https://example.invalid/"))).status, 422);
  assert.equal(state.events.length, 0);
  const denied = apiScenario(t, { denied: true });
  const unauthorized = denied.api.withAdmin("createReport", async () => assert.fail("handler must not run"));
  assert.equal((await unauthorized(new Request("https://example.invalid/"))).status, 401);
  assert.equal(denied.state.events.length, 0);
});

test("a telemetry failure cannot change an admin API error response", async (t) => {
  const { api } = apiScenario(t, { sdk: { captureException() { throw new Error("offline"); } } });
  assert.equal(api.serverError("createReport", new Error(secret)).status, 500);
});

for (const [filename, operation] of [
  ["src/app/[locale]/admin/(dashboard)/error.tsx", "admin.error-boundary"],
  ["src/app/[locale]/portal/(dashboard)/error.tsx", "portal.error-boundary"],
  ["src/app/global-error.tsx", "global.error-boundary"],
]) {
  test(`${operation} captures safely and suppresses repeated React effects`, () => {
    const { state, sdk } = captureBoundary();
    const load = appLoader({
      "@sentry/nextjs": sdk,
      react: { useEffect(effect) { effect(); effect(); } },
      "next-intl": { useTranslations: () => (key) => key },
      "@/components/portal/StateMessage": { __esModule: true, default: () => null },
      "next/error": { __esModule: true, default: () => null },
    });
    const boundary = load(filename).default;
    boundary({ error: new Error(secret), reset() {} });
    assert.equal(state.events.length, 1);
    assert.equal(state.events[0].tags.operation, operation);
    assert.equal(state.events[0].error.message, "Application operation failed");
  });
}

function workerScenario(status = "processing", updateWins = true) {
  const { state, sdk } = captureBoundary();
  let registration;
  const db = { from(table) {
    let mutation = false;
    const query = {
      select() { return query; }, eq() { return query; }, in() { return query; },
      update() { mutation = true; return query; },
      async maybeSingle() { return { data: status && (!mutation || updateWins) ? { status, insight_batch_id: requestId } : null, error: null }; },
      then(resolve, reject) { assert.equal(table, "insight_batches"); return Promise.resolve({ error: null }).then(resolve, reject); },
    };
    return query;
  } };
  const load = appLoader({
    "@sentry/nextjs": sdk,
    "@/lib/ai/process-job": { processAiJob() { assert.fail("not a worker execution test"); } },
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "@/lib/inngest/client": { inngest: { createFunction(config) { registration = config; } } },
  });
  load("src/lib/inngest/functions.ts");
  return { state, fail: () => registration.onFailure({ event: { data: { event: { data: { jobId } } } }, error: new Error(secret) }) };
}

test("an active terminal job failure reports its opaque job ID and performs a bounded flush", async () => {
  const { state, fail } = workerScenario();
  await fail();
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].tags.operation, "ai.insights.terminal");
  assert.deepEqual(state.events[0].contexts.application, { jobId });
  assert.deepEqual(state.flushes, [2000]);
  assert.equal(state.events[0].error.message, "Application operation failed");
});

for (const status of [null, "completed", "failed", "dead_letter"]) {
  test(`a terminal callback for a ${status ?? "deleted"} job does not capture or flush`, async () => {
    const { state, fail } = workerScenario(status);
    await fail();
    assert.equal(state.events.length, 0);
    assert.deepEqual(state.flushes, []);
  });
}

test("a cancelled terminal transition does not create a stale monitoring issue", async () => {
  const { state, fail } = workerScenario("processing", false);
  await fail();
  assert.deepEqual(state.events, []);
  assert.deepEqual(state.flushes, []);
});
