import assert from "node:assert/strict";
import { test } from "node:test";
import { appLoader } from "./helpers/app-loader.mjs";

const readToken = "read-private-token-never-disclose";
const buildToken = "build-private-token-never-use-at-runtime";
const actorId = "33a45d0d-366a-424d-819d-b20b5a228697";
const environmentNames = [
  "NODE_ENV", "SENTRY_ORG", "SENTRY_PROJECT", "SENTRY_REGION", "SENTRY_READ_AUTH_TOKEN", "SENTRY_AUTH_TOKEN",
  "SENTRY_UPLOAD_SOURCE_MAPS", "SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN", "NEXT_PUBLIC_SENTRY_ENABLED",
  "SENTRY_ENVIRONMENT", "NEXT_PUBLIC_SENTRY_ENVIRONMENT", "SENTRY_RELEASE", "NEXT_PUBLIC_SENTRY_RELEASE",
  "SENTRY_TRACES_SAMPLE_RATE", "NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE",
  "SENTRY_REPLAY_SESSION_SAMPLE_RATE", "NEXT_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE",
  "SENTRY_REPLAY_ERROR_SAMPLE_RATE", "NEXT_PUBLIC_SENTRY_REPLAY_ERROR_SAMPLE_RATE",
  "NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA", "VERCEL_GIT_COMMIT_SHA",
];

function configure(t, patch = {}) {
  const previous = Object.fromEntries(environmentNames.map((name) => [name, process.env[name]]));
  for (const name of environmentNames) delete process.env[name];
  Object.assign(process.env, {
    NODE_ENV: "production", SENTRY_ORG: "studio-org", SENTRY_PROJECT: "studio-app",
    SENTRY_READ_AUTH_TOKEN: readToken, SENTRY_AUTH_TOKEN: buildToken,
    NEXT_PUBLIC_SENTRY_DSN: "https://public-dsn-key@o1.ingest.sentry.io/123",
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

function issue(patch = {}) {
  return {
    id: "6789", shortId: "STUDIO-APP-1", title: "TypeError: Unable to load report",
    culprit: "/en/admin/reports", level: "error", status: "unresolved", count: "42", userCount: 7,
    firstSeen: "2026-10-12T10:00:00.000Z", lastSeen: "2026-10-13T11:00:00Z",
    project: { id: "123", slug: "studio-app" },
    assignedTo: { email: "private.person@example.com", name: "Private Person" },
    metadata: { value: readToken }, entries: [{ stacktrace: buildToken }],
    permalink: `https://untrusted.invalid/steal?token=${readToken}`,
    ...patch,
  };
}

function scenario(t, options = {}) {
  configure(t, options.env);
  const state = {
    role: "admin", project: { id: "123", slug: "studio-app", organization: { slug: "studio-org" }, securityToken: readToken },
    issues: [issue()], ...options, authChecks: 0, fetches: [],
  };
  const db = {
    auth: { async getUser() {
      state.authChecks++;
      return { data: { user: state.role ? { id: actorId } : null }, error: null };
    } },
    from(table) {
      assert.equal(table, "profiles");
      return {
        select() { return this; }, eq() { return this; },
        async maybeSingle() { return { data: { id: actorId, role: state.role, client_id: null }, error: null }; },
      };
    },
  };
  t.mock.method(globalThis, "fetch", async (url, init) => {
    state.fetches.push({ url, init });
    const parsed = new URL(url);
    assert.ok(["https://sentry.io", "https://de.sentry.io"].includes(parsed.origin));
    assert.equal(init.method, "GET");
    assert.equal(init.cache, "no-store");
    assert.equal(init.redirect, "error");
    assert.equal(init.headers.Authorization, `Bearer ${process.env.SENTRY_READ_AUTH_TOKEN}`);
    assert.ok(!url.includes(readToken) && !url.includes(buildToken));
    if (state.fetchResponse) return state.fetchResponse(url, init);
    if (state.httpStatus) return new Response(`${readToken} ${buildToken}`, { status: state.httpStatus });
    if (parsed.pathname === "/api/0/projects/studio-org/studio-app/") return Response.json(state.project);
    assert.equal(parsed.pathname, "/api/0/organizations/studio-org/issues/");
    return Response.json(state.issues, { headers: state.link ? { link: state.link } : {} });
  });
  const load = appLoader({
    "@/lib/supabase/server": { createClient: async () => db },
    "@/lib/security/logging": { logEvent() {}, errorCategory: () => "operation_failed", redact: (value) => value },
  });
  return {
    state, load,
    request: (query = "") => load("src/app/api/admin/system/sentry/route.ts").GET(new Request(`http://localhost/api/admin/system/sentry${query ? `?${query}` : ""}`)),
  };
}

function assertSafe(snapshot, extra = []) {
  const json = JSON.stringify(snapshot);
  for (const secret of [readToken, buildToken, "private.person@example.com", "Private Person", "securityToken", "stacktrace", "assignedTo", ...extra]) {
    assert.ok(!json.includes(secret), `Response exposed ${secret}`);
  }
}

for (const role of [null, "client"]) {
  test(`Sentry rejects ${role ?? "anonymous"} before configuration or provider calls`, async (t) => {
    const { state, request } = scenario(t, { role });
    assert.equal((await request("query=arbitrary")).status, 401);
    assert.equal(state.fetches.length, 0);
  });
}

test("admin receives a strict issue projection with verified project scope and safe links", async (t) => {
  const { state, request } = scenario(t);
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const snapshot = await response.json();
  assert.equal(snapshot.connection, "connected");
  assert.deepEqual(snapshot.filters, { status: "unresolved", period: "14d", environment: null });
  assert.deepEqual(snapshot.issues[0], {
    id: "6789", shortId: "STUDIO-APP-1", title: "TypeError: Unable to load report", location: "/en/admin/reports",
    level: "error", status: "unresolved", events: 42, users: 7,
    firstSeen: "2026-10-12T10:00:00.000Z", lastSeen: "2026-10-13T11:00:00.000Z",
    url: "https://sentry.io/organizations/studio-org/issues/6789/",
  });
  assert.equal(snapshot.links.issues, "https://sentry.io/organizations/studio-org/issues/?project=123");
  assert.equal(snapshot.links.projectKeys, "https://sentry.io/settings/studio-org/projects/studio-app/keys/");
  const query = new URL(state.fetches[1].url).searchParams;
  assert.deepEqual(Object.fromEntries(query), { project: "123", query: "is:unresolved", statsPeriod: "14d", limit: "20" });
  assertSafe(snapshot);
});

test("summaries scrub URLs, emails, quoted secrets, token values and query strings", async (t) => {
  const { request } = scenario(t, { issues: [issue({
    title: `Request failed https://alice:embedded-pass@example.invalid/?key=query-secret jane@example.com Bearer bearer-secret password="quoted-secret", ${readToken}; ${buildToken}`,
    culprit: "/api/report?token=location-secret#private-fragment",
  })] });
  const snapshot = await (await request()).json();
  assert.equal(snapshot.connection, "connected");
  assert.match(snapshot.issues[0].title, /Request failed/);
  assertSafe(snapshot, ["embedded-pass", "query-secret", "jane@example.com", "bearer-secret", "quoted-secret", "location-secret", "private-fragment"]);
});

test("the UI never forwards arbitrary upstream issue or project fields", async (t) => {
  const { request } = scenario(t, { issues: [issue({
    level: "private-level-secret", count: "unknown", userCount: -4,
    firstSeen: readToken, lastSeen: "not-a-date", unrecognizedPayload: { password: buildToken },
  })] });
  const snapshot = await (await request()).json();
  assert.equal(snapshot.issues[0].level, "unknown");
  for (const field of ["events", "users", "firstSeen", "lastSeen"]) assert.equal(snapshot.issues[0][field], null);
  assertSafe(snapshot, ["private-level-secret", "unrecognizedPayload"]);
});

test("approved filters and numeric pagination reach Sentry without a caller-supplied query", async (t) => {
  const cursor = "1731292800000:20:0";
  const { state, request } = scenario(t, {
    issues: [issue({ status: "resolved" })],
    link: '<https://untrusted.invalid/ignored>; rel="previous"; results="false"; cursor="0:0:1", <https://untrusted.invalid/steal>; rel="next"; results="true"; cursor="1731292800000:40:0"',
  });
  const snapshot = await (await request(`status=resolved&period=7d&environment=production-eu&cursor=${encodeURIComponent(cursor)}`)).json();
  assert.deepEqual(snapshot.filters, { status: "resolved", period: "7d", environment: "production-eu" });
  assert.equal(snapshot.nextCursor, "1731292800000:40:0");
  assert.deepEqual(Object.fromEntries(new URL(state.fetches[1].url).searchParams), {
    project: "123", query: "is:resolved", statsPeriod: "7d", limit: "20", environment: "production-eu", cursor,
  });
  assert.equal(state.fetches.length, 2);
});

for (const link of [
  '<https://sentry.io>; rel="next"; results="false"; cursor="0:20:0"',
  '<https://sentry.io>; rel="next"; results="true"; cursor="0:20:0&query=is:ignored"',
  '<https://sentry.io>; rel="previous"; results="true"; cursor="0:20:1"',
  '<https://sentry.io>; rel="next"; results="true"; cursor="https://untrusted.invalid"',
]) {
  test(`unsafe or exhausted pagination is ignored: ${link}`, async (t) => {
    const { request } = scenario(t, { link });
    assert.equal((await (await request()).json()).nextCursor, null);
  });
}

for (const query of [
  "query=is:resolved", "project=999", "status=all", "period=90d", "environment=prod%20OR%20project:999",
  "cursor=0:20:0%26query=other", "cursor=https://evil.invalid", "environment=", "status=resolved&status=unresolved",
  `environment=${"a".repeat(65)}`, `cursor=${"1".repeat(80)}:0:0`,
]) {
  test(`invalid search is rejected safely: ${query}`, async (t) => {
    const { state, request } = scenario(t);
    const response = await request(query);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { errorKey: "validationFailed" });
    assert.equal(state.fetches.length, 0);
  });
}

test("the build upload token is never used as a fallback for the read token", async (t) => {
  const { state, request } = scenario(t, { env: { SENTRY_READ_AUTH_TOKEN: undefined } });
  const snapshot = await (await request()).json();
  assert.equal(snapshot.connection, "setup_required");
  assert.equal(snapshot.configuration.readTokenConfigured, false);
  assert.equal(snapshot.configuration.sourceMaps, "configured");
  assert.deepEqual(snapshot.issues, []);
  assert.equal(snapshot.links.issues, null);
  assert.equal(state.fetches.length, 0);
  assertSafe(snapshot);
});

test("missing organization and project do not invent dashboards or issue counts", async (t) => {
  const { state, request } = scenario(t, { env: { SENTRY_ORG: undefined, SENTRY_PROJECT: undefined, SENTRY_AUTH_TOKEN: undefined } });
  const snapshot = await (await request()).json();
  assert.equal(snapshot.connection, "setup_required");
  assert.equal(snapshot.configuration.sourceMaps, "unverified");
  assert.equal(snapshot.configuration.organization, null);
  assert.equal(snapshot.configuration.project, null);
  assert.ok(Object.values(snapshot.links).every((link) => link === null));
  assert.equal(state.fetches.length, 0);
});

for (const patch of [
  { SENTRY_ORG: "https://evil.invalid/private" }, { SENTRY_PROJECT: "../elsewhere" }, { SENTRY_REGION: "https://evil.invalid" },
  { SENTRY_READ_AUTH_TOKEN: "bad\r\nheader" }, { NEXT_PUBLIC_SENTRY_DSN: "malformed-secret" },
  { NEXT_PUBLIC_SENTRY_DSN: "https://public:private@host.invalid/123" },
]) {
  test(`invalid integration configuration is rejected before network: ${Object.keys(patch)[0]}`, async (t) => {
    const { state, request } = scenario(t, { env: patch });
    const snapshot = await (await request()).json();
    assert.equal(snapshot.connection, "invalid_config");
    assert.ok(Object.values(snapshot.links).every((link) => link === null));
    assert.equal(state.fetches.length, 0);
    assertSafe(snapshot, Object.values(patch));
  });
}

test("EU data stays on the configured regional API and dashboard host", async (t) => {
  const { state, request } = scenario(t, { env: { SENTRY_REGION: "eu" } });
  const snapshot = await (await request()).json();
  assert.equal(snapshot.connection, "connected");
  assert.equal(snapshot.configuration.region, "eu");
  assert.ok(state.fetches.every(({ url }) => new URL(url).origin === "https://de.sentry.io"));
  assert.ok(Object.values(snapshot.links).every((url) => new URL(url).origin === "https://de.sentry.io"));
});

test("configuration reflects runtime enablement, sampling, release and explicit upload opt-out", async (t) => {
  const { request } = scenario(t, { env: {
    NODE_ENV: "development", NEXT_PUBLIC_SENTRY_ENABLED: "true", NEXT_PUBLIC_SENTRY_ENVIRONMENT: "staging",
    NEXT_PUBLIC_SENTRY_RELEASE: "studio@1.4.0", NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: "0.25",
    NEXT_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE: "0", NEXT_PUBLIC_SENTRY_REPLAY_ERROR_SAMPLE_RATE: "0.7",
    SENTRY_UPLOAD_SOURCE_MAPS: "false",
  } });
  const snapshot = await (await request()).json();
  const config = snapshot.configuration;
  assert.equal(config.sdkEnabled, true);
  assert.equal(config.browserEnabled, true);
  assert.equal(config.environment, "staging");
  assert.equal(config.release, "studio@1.4.0");
  assert.equal(config.tracesSampleRate, 0.25);
  assert.equal(config.replaySessionSampleRate, 0);
  assert.equal(config.replayOnErrorSampleRate, 0.7);
  assert.equal(config.sourceMaps, "disabled");
});

test("a server-only DSN keeps browser monitoring visibly unconfigured", async (t) => {
  const { request } = scenario(t, { env: { NEXT_PUBLIC_SENTRY_DSN: undefined, SENTRY_DSN: "https://public@o1.ingest.sentry.io/123" } });
  const config = (await (await request()).json()).configuration;
  assert.equal(config.sdkEnabled, true);
  assert.equal(config.dsnConfigured, true);
  assert.equal(config.browserEnabled, false);
  assert.equal(config.browserDsnConfigured, false);
});

for (const env of [{ NODE_ENV: "development" }, { NEXT_PUBLIC_SENTRY_ENABLED: "false" }]) {
  test(`disabled SDK state reflects configuration: ${JSON.stringify(env)}`, async (t) => {
    const { request } = scenario(t, { env });
    const snapshot = await (await request()).json();
    assert.equal(snapshot.connection, "connected", "Read API remains independent from SDK capture");
    assert.equal(snapshot.configuration.sdkEnabled, false);
    assert.equal(snapshot.configuration.browserEnabled, false);
  });
}

for (const options of [
  { project: { id: "999", slug: "studio-app" } },
  { project: { id: "123", slug: "another-project" } },
  { project: { id: "123", organization: { slug: "another-org" } } },
  { env: { SENTRY_DSN: "https://public@o1.ingest.sentry.io/999" } },
]) {
  test("project and DSN ownership must match before requesting issues", async (t) => {
    const { state, request } = scenario(t, options);
    const snapshot = await (await request()).json();
    assert.equal(snapshot.connection, "project_mismatch");
    assert.deepEqual(snapshot.issues, []);
    assert.equal(snapshot.links.issues, null);
    assert.equal(state.fetches.length, 1);
  });
}

for (const project of [{ id: "999", slug: "another-project" }, { id: "123", slug: "another-project" }]) {
  test("a cross-project issue invalidates the whole page instead of exposing other project data", async (t) => {
    const { request } = scenario(t, { issues: [issue(), issue({ id: "99999", project, title: "private-other-project-error" })] });
    const snapshot = await (await request()).json();
    assert.equal(snapshot.connection, "project_mismatch");
    assert.deepEqual(snapshot.issues, []);
    assertSafe(snapshot, ["private-other-project-error"]);
  });
}

for (const [httpStatus, connection] of [[401, "unauthorized"], [403, "forbidden"], [429, "rate_limited"], [404, "unavailable"], [500, "unavailable"]]) {
  test(`provider HTTP ${httpStatus} becomes safe ${connection} state`, async (t) => {
    const { request } = scenario(t, { httpStatus });
    const response = await request();
    assert.equal(response.status, 200);
    const snapshot = await response.json();
    assert.equal(snapshot.connection, connection);
    assert.deepEqual(snapshot.issues, []);
    assertSafe(snapshot);
  });
}

test("authorization runs for every request even when snapshots are cached or coalesced", async (t) => {
  const { state, request } = scenario(t);
  const responses = await Promise.all([request(), request()]);
  assert.deepEqual(await responses[0].json(), await responses[1].json());
  assert.equal(state.authChecks, 2);
  assert.equal(state.fetches.length, 2);
  assert.equal((await request()).status, 200);
  assert.equal(state.authChecks, 3);
  assert.equal(state.fetches.length, 2);
  state.role = "client";
  assert.equal((await request()).status, 401);
  assert.equal(state.authChecks, 4);
  assert.equal(state.fetches.length, 2);
});

test("snapshot cache varies by filters and rotated read token", async (t) => {
  const { state, request } = scenario(t);
  await request();
  await request("environment=preview");
  assert.equal(state.fetches.length, 4);
  process.env.SENTRY_READ_AUTH_TOKEN = "rotated-read-token";
  await request();
  assert.equal(state.fetches.length, 6);
});

test("snapshot cache expires after 30 seconds", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: new Date("2026-10-13T10:00:00Z") });
  const { state, request } = scenario(t);
  await request();
  t.mock.timers.tick(29_999);
  await request();
  assert.equal(state.fetches.length, 2);
  t.mock.timers.tick(2);
  await request();
  assert.equal(state.fetches.length, 4);
});

test("snapshot cache retains at most 20 query entries", async (t) => {
  const { state, request } = scenario(t);
  for (let index = 0; index <= 20; index++) await request(`environment=preview-${index}`);
  assert.equal(state.fetches.length, 42);
  await request("environment=preview-0");
  assert.equal(state.fetches.length, 44, "Oldest cache entry must be evicted");
});

for (const hangBody of [false, true]) {
  test(`a stalled ${hangBody ? "response body" : "fetch"} is bounded and aborted`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { state, request } = scenario(t, { fetchResponse: () => hangBody
      ? new Response(new ReadableStream({ start() {} }))
      : new Promise(() => {}),
    });
    const pending = request();
    await new Promise((resolve) => setImmediate(resolve));
    t.mock.timers.tick(5_001);
    const snapshot = await (await pending).json();
    assert.equal(snapshot.connection, "unavailable");
    assert.ok(state.fetches[0].init.signal.aborted);
    assertSafe(snapshot);
  });
}

test("oversized declared bodies are rejected without reading them", async (t) => {
  let read = false;
  const { request } = scenario(t, { fetchResponse: () => new Response(new ReadableStream({ pull() { read = true; } }, { highWaterMark: 0 }), { headers: { "content-length": "1048577" } }) });
  const snapshot = await (await request()).json();
  assert.equal(snapshot.connection, "unavailable");
  assert.equal(read, false);
});

test("chunked bodies are capped even when the content-length header is absent", async (t) => {
  const { request } = scenario(t, { fetchResponse: () => new Response(`{"private":"${"x".repeat(1_048_576)}"}`) });
  const snapshot = await (await request()).json();
  assert.equal(snapshot.connection, "unavailable");
  assertSafe(snapshot);
});

for (const options of [
  { project: { id: "https://evil.invalid" } },
  { issues: { detail: readToken } },
  { issues: Array.from({ length: 21 }, () => issue()) },
  { issues: [issue({ id: "../evil" })] },
  { fetchResponse: () => new Response("invalid json") },
  { fetchResponse: () => { throw new Error(readToken); } },
]) {
  test("malformed responses and provider exceptions remain safe and unavailable", async (t) => {
    const { request } = scenario(t, options);
    const snapshot = await (await request()).json();
    assert.equal(snapshot.connection, "unavailable");
    assert.deepEqual(snapshot.issues, []);
    assertSafe(snapshot);
  });
}

test("the workspace endpoint exposes read-only operations", (t) => {
  const { load } = scenario(t);
  const route = load("src/app/api/admin/system/sentry/route.ts");
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) assert.equal(route[method], undefined);
});
