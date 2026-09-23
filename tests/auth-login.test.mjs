import assert from "node:assert/strict";
import { test } from "node:test";
import { createServerClient } from "@supabase/ssr";
import { appLoader } from "./helpers/app-loader.mjs";

const userId = "33a45d0d-366a-424d-819d-b20b5a228697";
const clientId = "976e0219-3647-460a-8418-fbc305fc86aa";
const cookieName = "sb-auth-test-auth-token";
const credentials = { email: "login@example.invalid", password: "test-password" };
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json" },
});

function scenario(options = {}) {
  const state = {
    profile: { role: "admin", client_id: null },
    existingCookies: [],
    invalidPassword: false,
    missingSession: false,
    profileError: false,
    profileThrow: false,
    cleanupError: false,
    metadata: {},
    ...options,
    requests: [],
    logoutScopes: [],
    logs: [],
  };
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const jwtPart = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const accessToken = `${jwtPart({ alg: "HS256", typ: "JWT" })}.${jwtPart({ sub: userId, exp: expiresAt, role: "authenticated" })}.test-signature`;
  const user = { id: userId, email: credentials.email, user_metadata: state.metadata };

  // Run the installed Supabase SSR/auth clients with a fake HTTP provider.
  // This covers their real cookie serialization and session lifecycle.
  const providerFetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    state.requests.push(url.pathname);
    if (url.pathname === "/auth/v1/token") {
      assert.equal(url.searchParams.get("grant_type"), "password", "never refresh an existing session");
      assert.deepEqual(JSON.parse(init.body), { ...credentials, gotrue_meta_security: {} });
      if (state.invalidPassword) return json({ code: "invalid_credentials", message: "Invalid login credentials" }, 400);
      if (state.missingSession) return json({ user });
      return json({
        user, access_token: accessToken, refresh_token: "new-private-refresh-token",
        token_type: "bearer", expires_in: 3600, expires_at: expiresAt,
      });
    }
    if (url.pathname === "/rest/v1/profiles") {
      assert.equal(new Headers(init.headers).get("authorization"), `Bearer ${accessToken}`);
      assert.equal(url.searchParams.get("id"), `eq.${userId}`);
      assert.equal(url.searchParams.get("select"), "role,client_id");
      if (state.profileThrow) throw new Error("Synthetic profile transport failure");
      if (state.profileError) return json({ code: "XX000", message: "Synthetic database failure" }, 500);
      return json(state.profile ? [state.profile] : []);
    }
    if (url.pathname === "/auth/v1/logout") {
      state.logoutScopes.push(url.searchParams.get("scope"));
      assert.equal(new Headers(init.headers).get("authorization"), `Bearer ${accessToken}`);
      if (state.cleanupError) return json({ code: "unexpected_failure", message: "Synthetic logout failure" }, 500);
      return new Response(null, { status: 204 });
    }
    assert.fail(`Unexpected provider request: ${url.pathname}`);
  };
  const route = appLoader({
    "@/lib/env": { supabaseUrl: () => "https://auth-test.supabase.co", supabaseAnonKey: () => "test-anon-key" },
    "next/headers": { cookies: async () => ({
      getAll: () => state.existingCookies,
      set: () => assert.fail("Login cookies must only be written to the approved response"),
    }) },
    "@supabase/ssr": { createServerClient: (url, key, config) => createServerClient(url, key, {
      ...config, global: { fetch: providerFetch },
    }) },
    "@/lib/security/logging": {
      logEvent: (event) => state.logs.push(event),
      errorCategory: () => "TEST_ERROR",
    },
  })("src/app/api/auth/login/route.ts");

  return {
    state,
    request: (body = {}) => route.POST(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ ...credentials, expectedRole: "admin", locale: "en", ...body }),
      headers: { "content-type": "application/json" },
    })),
  };
}

async function assertRejected(response, status, errorKey) {
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), { errorKey });
  assert.equal(response.headers.get("set-cookie"), null);
}

for (const locale of ["en", "ar"]) {
  for (const [role, area] of [["admin", "admin"], ["client", "portal"]]) {
    test(`${locale}: ${role} login only succeeds in its own area`, async () => {
      const { request, state } = scenario({ profile: { role, client_id: role === "client" ? clientId : null } });
      const response = await request({ expectedRole: role, locale });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { redirectTo: `/${locale}/${area}` });
      assert.equal(response.headers.get("cache-control"), "no-store");
      const authCookie = response.cookies.get(cookieName);
      assert.ok(authCookie?.value.startsWith("base64-"));
      const session = JSON.parse(Buffer.from(authCookie.value.slice(7), "base64url").toString());
      assert.equal(session.user.id, userId);
      assert.equal(session.refresh_token, "new-private-refresh-token");
      assert.deepEqual(state.logoutScopes, []);
    });
  }

  test(`${locale}: admin credentials at portal login are rejected without a session`, async () => {
    const { request, state } = scenario();
    await assertRejected(await request({ expectedRole: "client", locale }), 401, "invalidCredentials");
    assert.deepEqual(state.logoutScopes, ["local"]);
  });

  test(`${locale}: client credentials at admin login cannot obtain admin access`, async () => {
    const { request, state } = scenario({ profile: { role: "client", client_id: clientId } });
    await assertRejected(await request({ locale }), 401, "invalidCredentials");
    assert.deepEqual(state.logoutScopes, ["local"]);
  });
}

test("wrong-area login and invalid password return the same generic failure", async () => {
  const mismatch = scenario();
  const invalid = scenario({ invalidPassword: true });
  const first = await mismatch.request({ expectedRole: "client" });
  const second = await invalid.request({ expectedRole: "client" });
  assert.equal(first.status, second.status);
  assert.deepEqual(await first.json(), await second.json());
  assert.equal(first.headers.get("set-cookie"), null);
  assert.equal(second.headers.get("set-cookie"), null);
  assert.deepEqual(invalid.state.requests, ["/auth/v1/token"]);
});

for (const [label, options, status, errorKey, body] of [
  ["missing profile", { profile: null }, 403, "noProfile", {}],
  ["missing client binding", { profile: { role: "client", client_id: null } }, 403, "noClient", { expectedRole: "client" }],
  ["profile query failure", { profileError: true }, 500, "serverError", {}],
  ["profile transport failure", { profileThrow: true }, 500, "serverError", {}],
  ["unsupported stored role", { profile: { role: "superadmin", client_id: clientId } }, 401, "invalidCredentials", {}],
  ["absent token session", { missingSession: true }, 401, "invalidCredentials", {}],
]) {
  test(`${label} fails without publishing session cookies`, async () => {
    const { request } = scenario(options);
    await assertRejected(await request(body), status, errorKey);
  });
}

test("logout failure cannot publish a rejected login's cookies or replace its error", async () => {
  const { request, state } = scenario({ cleanupError: true });
  await assertRejected(await request({ expectedRole: "client" }), 401, "invalidCredentials");
  assert.deepEqual(state.logoutScopes, ["local"]);
  assert.deepEqual(state.logs, [{ operation: "login:cleanup", outcome: "error", category: "TEST_ERROR" }]);
});

test("editable user metadata cannot override the authenticated profile's role", async () => {
  const { request } = scenario({
    profile: { role: "client", client_id: clientId },
    metadata: { role: "admin", id: "another-user", client_id: "another-client" },
  });
  await assertRejected(await request(), 401, "invalidCredentials");
});

for (const expectedRole of [undefined, null, "superadmin", "", { role: "admin" }]) {
  test(`invalid expectedRole ${JSON.stringify(expectedRole)} is rejected before authentication`, async () => {
    const { request, state } = scenario();
    const response = await request({ expectedRole });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).errorKey, "validationFailed");
    assert.equal(response.headers.get("set-cookie"), null);
    assert.deepEqual(state.requests, []);
  });
}

test("invalid locale cannot create an external redirect", async () => {
  const { request } = scenario();
  const response = await request({ locale: "https://example.invalid" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { redirectTo: "/en/admin" });
});

test("a successful login removes old session chunks and preserves unrelated cookies", async () => {
  const { request, state } = scenario({ existingCookies: [
    { name: `${cookieName}.0`, value: "old-session-part-0" },
    { name: `${cookieName}.1`, value: "old-session-part-1" },
    { name: "theme", value: "dark" },
  ] });
  const response = await request();
  assert.equal(response.status, 200);
  for (const index of [0, 1]) {
    const removed = response.cookies.get(`${cookieName}.${index}`);
    assert.equal(removed.value, "");
    assert.equal(removed.maxAge, 0);
  }
  assert.ok(response.cookies.get(cookieName)?.value);
  assert.equal(response.cookies.get("theme"), undefined);
  assert.deepEqual(state.requests, ["/auth/v1/token", "/rest/v1/profiles"]);
});

test("large successful sessions replace the old base cookie with complete chunks", async () => {
  const { request } = scenario({
    metadata: { description: "x".repeat(8000) },
    existingCookies: [{ name: cookieName, value: "old-session" }],
  });
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.cookies.get(cookieName).maxAge, 0);
  const chunks = response.cookies.getAll().filter(({ name }) => name.startsWith(`${cookieName}.`));
  assert.ok(chunks.length > 1);
  const encoded = chunks.map(({ value }) => value).join("");
  const session = JSON.parse(Buffer.from(encoded.slice(7), "base64url").toString());
  assert.equal(session.user.user_metadata.description.length, 8000);
});

test("rejected attempts do not refresh, revoke, or replace a pre-existing browser session", async () => {
  const oldSession = {
    access_token: "previous-access-token", refresh_token: "previous-refresh-token",
    expires_at: 1, user: { id: "previous-user" },
  };
  const originalCookie = { name: cookieName, value: `base64-${Buffer.from(JSON.stringify(oldSession)).toString("base64url")}` };
  for (const invalidPassword of [true, false]) {
    const { request, state } = scenario({ existingCookies: [originalCookie], invalidPassword });
    await assertRejected(await request({ expectedRole: "client" }), 401, "invalidCredentials");
    assert.deepEqual(state.existingCookies, [originalCookie]);
    assert.deepEqual(state.requests, invalidPassword ? ["/auth/v1/token"] : ["/auth/v1/token", "/rest/v1/profiles", "/auth/v1/logout"]);
  }
});
