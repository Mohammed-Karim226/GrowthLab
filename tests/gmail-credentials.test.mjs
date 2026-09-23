import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Compile the actual app modules in memory, replacing only external I/O.
// This exercises the real admin guard, API wrapper, schema and encryption.
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
function appLoader(overrides = {}) {
  const cache = new Map();
  function load(relativePath) {
    const filename = path.resolve(root, relativePath);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} };
    cache.set(filename, loaded);
    const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    const appRequire = (specifier) => {
      // Next.js resolves this build-time marker; this runner is already server-side.
      if (specifier === "server-only") return {};
      if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
      if (specifier.startsWith("@/")) return load(`src/${specifier.slice(2)}.ts`);
      if (specifier.startsWith(".")) return load(path.resolve(path.dirname(filename), `${specifier}.ts`));
      return require(specifier);
    };
    new Function("require", "module", "exports", compiled)(appRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return load;
}

const load = appLoader();
const { encryptSecret } = load("src/lib/security/secrets.ts");
const logging = load("src/lib/security/logging.ts");
const { credentialMetadata } = load("src/lib/security/credential-metadata.ts");
const accountId = "722b546b-82d3-4c2e-befe-74c6fb5f8504";
const clientId = "976e0219-3647-460a-8418-fbc305fc86aa";
const actorId = "33a45d0d-366a-424d-819d-b20b5a228697";
const payload = {
  email: "verification@example.invalid",
  password: "Gmail-only-test-كلمة<&>",
  notes: "Do not reveal notes",
  relatedAccounts: [{ id: "related-1", service: "Example", username: "test-user", password: "Related-only-test-123" }],
};
let originalKeys;
let originalActive;
beforeEach(() => {
  originalKeys = process.env.CREDENTIAL_ENCRYPTION_KEYS;
  originalActive = process.env.CREDENTIAL_ACTIVE_KEY_ID;
  process.env.CREDENTIAL_ENCRYPTION_KEYS = JSON.stringify({ test: randomBytes(32).toString("base64") });
  process.env.CREDENTIAL_ACTIVE_KEY_ID = "test";
});
afterEach(() => {
  if (originalKeys === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEYS;
  else process.env.CREDENTIAL_ENCRYPTION_KEYS = originalKeys;
  if (originalActive === undefined) delete process.env.CREDENTIAL_ACTIVE_KEY_ID;
  else process.env.CREDENTIAL_ACTIVE_KEY_ID = originalActive;
});

function scenario(options = {}) {
  const state = {
    role: "admin",
    account: { id: accountId, client_id: clientId, has_secret: true },
    stored: { secret_ciphertext: encryptSecret(payload, `${clientId}:${accountId}`) },
    auditError: null,
    readError: null,
    ...options,
    privilegedClients: 0,
    reads: [],
    audit: [],
    logs: [],
  };
  function from(table, privileged) {
    const read = { table, privileged, columns: null, filters: {} };
    const query = {
      select(columns) { read.columns = columns; return query; },
      eq(column, value) { read.filters[column] = value; return query; },
      async maybeSingle() {
        state.reads.push(read);
        if (table === "profiles") return { data: state.role ? { id: actorId, role: state.role, client_id: clientId } : null };
        assert.equal(table, "client_gmail_accounts");
        if (!privileged) return { data: state.account };
        assert.deepEqual(read.filters, { id: accountId, client_id: clientId });
        return { data: state.stored, error: state.readError };
      },
      async insert(entry) {
        assert.equal(table, "audit_logs");
        assert.equal(privileged, true);
        state.audit.push(entry);
        return { error: state.auditError };
      },
    };
    return query;
  }
  const sessionClient = {
    auth: { getUser: async () => ({ data: { user: state.role ? { id: actorId, email: "admin@example.invalid" } : null } }) },
    from: (table) => from(table, false),
  };
  const route = appLoader({
    "@/lib/supabase/server": { createClient: async () => sessionClient },
    "@/lib/supabase/admin": { createAdminClient: () => {
      state.privilegedClients += 1;
      return { from: (table) => from(table, true) };
    } },
    "@/lib/security/logging": { ...logging, logEvent: (event) => state.logs.push(event) },
  })("src/app/api/admin/gmail-accounts/[accountId]/reveal/route.ts");
  return {
    state,
    request: (id = accountId) => route.POST(
      new Request(`http://localhost/api/admin/gmail-accounts/${id}/reveal`, { method: "POST" }),
      { params: Promise.resolve({ accountId: id }) },
    ),
  };
}

function assertNoPasswords(value) {
  const serialized = JSON.stringify(value);
  assert.ok(!serialized.includes(payload.password));
  assert.ok(!serialized.includes(payload.relatedAccounts[0].password));
}

test("an admin can reveal Gmail and related passwords with no-store and a secret-free audit", async () => {
  const { request, state } = scenario();
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { credentials: { password: payload.password, relatedAccounts: payload.relatedAccounts } });
  assert.deepEqual(state.audit, [{
    actor_id: actorId,
    action: "CREDENTIAL_REVEALED",
    entity_type: "client_gmail_account",
    entity_id: accountId,
    metadata: { clientId },
  }]);
  assertNoPasswords(state.audit);
  assertNoPasswords(state.logs);
  assert.equal(state.reads.find((read) => read.privileged).columns, "secret_ciphertext");
});

for (const role of [null, "client"]) {
  test(`${role ?? "anonymous"} callers cannot read credentials or construct a privileged client`, async () => {
    const { request, state } = scenario({ role });
    const response = await request();
    assert.equal(response.status, 401);
    assertNoPasswords(await response.json());
    assert.equal(state.privilegedClients, 0);
    assert.ok(state.reads.every((read) => read.table === "profiles"));
    assert.deepEqual(state.audit, []);
  });
}

test("a row hidden from the session cannot be revealed through privileged access", async () => {
  const { request, state } = scenario({ account: null });
  assert.equal((await request()).status, 404);
  assert.equal(state.privilegedClients, 0);
});

test("invalid account IDs are rejected before querying credentials", async () => {
  const { request, state } = scenario();
  assert.equal((await request("invalid-id")).status, 404);
  assert.equal(state.privilegedClients, 0);
  assert.ok(state.reads.every((read) => read.table === "profiles"));
});

test("legacy rows without an encrypted secret cannot reveal plaintext columns", async () => {
  const { request, state } = scenario({ account: { id: accountId, client_id: clientId, has_secret: false } });
  const response = await request();
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { errorKey: "credentialUnavailable" });
  assert.equal(state.privilegedClients, 0);
});

test("missing ciphertext returns a safe unavailable error", async () => {
  const { request, state } = scenario({ stored: { secret_ciphertext: null } });
  const response = await request();
  assert.equal(response.status, 409);
  assertNoPasswords(await response.json());
  assert.deepEqual(state.audit, []);
});

test("a row deleted during reveal is handled without returning passwords", async () => {
  const { request, state } = scenario({ stored: null });
  assert.equal((await request()).status, 404);
  assert.deepEqual(state.audit, []);
});

test("ciphertext from another row cannot be revealed", async () => {
  const { request, state } = scenario({ stored: { secret_ciphertext: encryptSecret(payload, `${clientId}:another-account`) } });
  const response = await request();
  assert.equal(response.status, 409);
  assertNoPasswords(await response.json());
  assert.deepEqual(state.audit, []);
});

test("tampered ciphertext cannot be revealed", async () => {
  const parts = encryptSecret(payload, `${clientId}:${accountId}`).split(".");
  const bytes = Buffer.from(parts[4], "base64url");
  bytes[0] ^= 1;
  parts[4] = bytes.toString("base64url");
  const { request, state } = scenario({ stored: { secret_ciphertext: parts.join(".") } });
  const response = await request();
  assert.equal(response.status, 409);
  assertNoPasswords(await response.json());
  assert.deepEqual(state.audit, []);
});

test("malformed decrypted data is not sent to the browser", async () => {
  const { request, state } = scenario({ stored: { secret_ciphertext: encryptSecret({ password: payload.password }, `${clientId}:${accountId}`) } });
  const response = await request();
  assert.equal(response.status, 409);
  assertNoPasswords(await response.json());
  assert.deepEqual(state.audit, []);
});

test("an audit failure prevents password disclosure", async () => {
  const { request, state } = scenario({ auditError: { code: "XX000", message: "Synthetic database failure" } });
  const response = await request();
  assert.equal(response.status, 500);
  assertNoPasswords(await response.json());
  assertNoPasswords(state.logs);
});

test("a storage read failure prevents password disclosure", async () => {
  const { request, state } = scenario({ readError: { code: "XX000" } });
  const response = await request();
  assert.equal(response.status, 500);
  assertNoPasswords(await response.json());
  assert.deepEqual(state.audit, []);
});

test("missing encryption configuration retains the dedicated 503 response", async () => {
  const { request, state } = scenario();
  delete process.env.CREDENTIAL_ENCRYPTION_KEYS;
  const response = await request();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { errorKey: "credentialConfig" });
  assert.equal(state.privilegedClients, 0);
});

test("routine metadata projections still exclude passwords and ciphertext", () => {
  const metadata = credentialMetadata({
    id: accountId, client_id: clientId, email: payload.email,
    has_secret: true, created_at: "", updated_at: "",
    services: [{ ...payload.relatedAccounts[0], has_secret: true }],
    password: payload.password,
    secret_ciphertext: "must-not-be-returned",
    related_accounts: payload.relatedAccounts,
  });
  assertNoPasswords(metadata);
  assert.equal(Object.hasOwn(metadata, "secret_ciphertext"), false);
  assert.equal(Object.hasOwn(metadata, "related_accounts"), false);
  assert.equal(Object.hasOwn(metadata.services[0], "password"), false);
});
