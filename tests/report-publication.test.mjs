import assert from "node:assert/strict";
import { test } from "node:test";
import { appLoader } from "./helpers/app-loader.mjs";

const actorId = "33a45d0d-366a-424d-819d-b20b5a228697";
const reportId = "ea30d44e-3217-4dc7-bb27-f278aa41780d";
const versionId = "e61a14eb-3669-4615-a601-f33c1d0495ee";
const otherId = "626d0a49-fae0-46bd-8b12-0536e6c7d48d";
const databaseTimestamp = "2026-03-02T10:15:30.000Z";
const logging = appLoader()("src/lib/security/logging.ts");

// Keep the real routes, validation, authorization and transition helper. Only
// Supabase I/O is replaced; publication writes must cross the RPC boundary.
function scenario(options = {}) {
  const state = {
    role: "admin",
    report: { id: reportId, current_published_version_id: versionId },
    version: {
      id: versionId, report_id: reportId, status: "published", revision: 7,
      version_number: 2, summary: "Reviewed summary", published_at: databaseTimestamp,
    },
    metrics: [{ id: otherId, needs_review: false, metric_value: 42 }],
    ...options,
    reads: [],
    writes: [],
    transitions: [],
    logs: [],
  };
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: state.role ? { id: actorId } : null }, error: null }),
      getSession() { assert.fail("Publication authorization must revalidate the user"); },
    },
    from(table) {
      const operation = { table, filters: {}, columns: null };
      let pending;
      function execute() {
        if (pending) return pending;
        pending = Promise.resolve().then(() => {
          if (operation.values) {
            state.writes.push(operation);
            assert.equal(table, "report_versions", "Only a guarded summary edit may precede the transition RPC");
            assert.deepEqual(Object.keys(operation.values), ["summary"], "Status and pointer writes must be atomic inside the RPC");
            assert.equal(operation.filters.id, versionId);
            assert.equal(operation.filters.revision, state.version.revision, "Summary edits must check the revision");
            if (state.summaryError) return { data: null, error: state.summaryError };
            if (state.summaryConflict) return { data: null, error: null };
            state.version = { ...state.version, ...operation.values, revision: state.version.revision + 1 };
            return { data: { ...state.version }, error: null };
          }
          state.reads.push(operation);
          if (table === "profiles") {
            assert.deepEqual(operation.filters, { id: actorId });
            return { data: { id: actorId, role: state.role, client_id: null }, error: null };
          }
          if (state.readError) return { data: null, error: state.readError };
          if (table === "metrics") {
            assert.equal(operation.filters.report_version_id, versionId);
            return { data: state.metrics, error: null };
          }
          assert.ok(["reports", "report_versions"].includes(table), `Unexpected table ${table}`);
          const row = table === "reports" ? state.report : state.version;
          const found = row && Object.entries(operation.filters).every(([key, value]) => row[key] === value);
          return { data: found ? { ...row } : null, error: null };
        });
        return pending;
      }
      const query = {
        select(columns) { operation.columns = columns; return query; },
        eq(column, value) { operation.filters[column] = value; return query; },
        is(column, value) { operation.filters[column] = value; return query; },
        update(values) { operation.values = values; return query; },
        insert(values) {
          state.writes.push({ table, values });
          assert.fail("The transition RPC must own its audit insert");
        },
        returns() { return query; },
        maybeSingle: execute,
        single: execute,
        then(resolve, reject) { return execute().then(resolve, reject); },
      };
      return query;
    },
    async rpc(name, args) {
      state.transitions.push({ name, args });
      assert.equal(name, "transition_report");
      assert.deepEqual(Object.keys(args).sort(), ["p_action", "p_expected_published", "p_report", "p_revision", "p_version"]);
      assert.equal(args.p_report, reportId);
      assert.equal(args.p_version, versionId);
      if (state.rpcError) return { data: null, error: state.rpcError };
      const liveRevision = state.liveRevision ?? state.version.revision;
      const livePointer = Object.hasOwn(state, "livePointer") ? state.livePointer : state.report.current_published_version_id;
      if (args.p_revision !== liveRevision || args.p_expected_published !== livePointer) {
        return { data: null, error: { code: "40001", message: "Concurrent report change" } };
      }
      const status = args.p_action === "publish" ? "published" : "approved";
      state.version = {
        ...state.version, status, revision: liveRevision + 1,
        published_at: status === "published" ? databaseTimestamp : null,
      };
      if (args.p_action === "publish") state.report.current_published_version_id = versionId;
      if (args.p_action === "unpublish") state.report.current_published_version_id = null;
      return { data: { ...state.version }, error: null };
    },
  };
  const load = appLoader({
    "@/lib/supabase/server": { createClient: async () => supabase },
    "@/lib/security/logging": { ...logging, logEvent: (event) => state.logs.push(event) },
  });
  return {
    state,
    request(action = "unpublish", body = { reportVersionId: versionId }) {
      const endpoint = action === "approve" ? "approve" : "publish";
      const method = action === "unpublish" ? "DELETE" : "POST";
      const route = load(`src/app/api/admin/reports/[reportId]/${endpoint}/route.ts`);
      return route[method](new Request(`http://localhost/api/admin/reports/${reportId}/${endpoint}`, {
        method,
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }), { params: Promise.resolve({ reportId }) });
    },
  };
}

function editableOptions(overrides = {}) {
  return {
    report: { id: reportId, current_published_version_id: null },
    version: {
      id: versionId, report_id: reportId, status: "approved", revision: 7,
      version_number: 2, summary: "Reviewed summary", published_at: null,
    },
    ...overrides,
  };
}

function draftOptions(overrides = {}) {
  const options = editableOptions(overrides);
  options.version.status = "draft";
  return options;
}

async function assertError(response, status, errorKey) {
  assert.equal(response.status, status);
  assert.equal((await response.json()).errorKey, errorKey);
}

for (const action of ["approve", "publish", "unpublish"]) {
  for (const role of [null, "client"]) {
    test(`${action}: ${role ?? "anonymous"} callers cannot read or mutate reports`, async () => {
      const { request, state } = scenario({ role });
      await assertError(await request(action), 401, "unauthorized");
      assert.ok(state.reads.every((read) => read.table === "profiles"));
      assert.deepEqual(state.writes, []);
      assert.deepEqual(state.transitions, []);
    });
  }

  for (const [label, body, status, errorKey] of [
    ["malformed JSON", "{", 400, "invalidJson"],
    ["missing version", {}, 422, "validationFailed"],
    ["invalid version", { reportVersionId: "invalid" }, 422, "validationFailed"],
    ["invalid revision", { reportVersionId: versionId, revision: -1 }, 422, "validationFailed"],
    ["invalid published pointer", { reportVersionId: versionId, expectedPublishedVersionId: "invalid" }, 422, "validationFailed"],
  ]) {
    test(`${action}: rejects ${label} before report access`, async () => {
      const { request, state } = scenario();
      await assertError(await request(action, body), status, errorKey);
      assert.ok(state.reads.every((read) => read.table === "profiles"));
      assert.deepEqual(state.writes, []);
      assert.deepEqual(state.transitions, []);
    });
  }

  test(`${action}: a version belonging to another report cannot be changed`, async () => {
    const { request, state } = scenario({
      version: { id: versionId, report_id: otherId, status: "approved", revision: 7 },
    });
    await assertError(await request(action), 404, "notFound");
    assert.deepEqual(state.transitions, []);
    assert.deepEqual(state.writes, []);
  });
}

test("unpublish atomically clears portal visibility and returns the version to approved", async () => {
  const { request, state } = scenario();
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.versionId, versionId);
  assert.equal(body.status, "approved");
  assert.equal(state.report.current_published_version_id, null);
  assert.equal(state.version.status, "approved");
  assert.equal(state.version.published_at, null);
  assert.deepEqual(state.transitions, [{ name: "transition_report", args: {
    p_report: reportId, p_version: versionId, p_revision: 7,
    p_expected_published: versionId, p_action: "unpublish",
  } }]);
  assert.deepEqual(state.writes, []);
});

for (const pointer of [null, otherId]) {
  test(`unpublish cannot clear a ${pointer === null ? "missing" : "different"} published pointer`, async () => {
    const { request, state } = scenario({ report: { id: reportId, current_published_version_id: pointer } });
    await assertError(await request(), 409, "notPublished");
    assert.deepEqual(state.transitions, []);
    assert.deepEqual(state.writes, []);
    assert.equal(state.report.current_published_version_id, pointer);
  });
}

for (const field of ["report", "version"]) {
  test(`unpublish returns notFound for a missing ${field}`, async () => {
    const { request, state } = scenario({ [field]: null });
    await assertError(await request(), 404, "notFound");
    assert.deepEqual(state.transitions, []);
    assert.deepEqual(state.writes, []);
  });
}

for (const [label, expectations] of [
  ["revision", { revision: 6, expectedPublishedVersionId: versionId }],
  ["published pointer", { revision: 7, expectedPublishedVersionId: null }],
]) {
  test(`unpublish rejects a stale submitted ${label}`, async () => {
    const { request, state } = scenario();
    await assertError(await request("unpublish", { reportVersionId: versionId, ...expectations }), 409, "staleReport");
    assert.equal(state.report.current_published_version_id, versionId);
    assert.equal(state.version.status, "published");
    assert.deepEqual(state.writes, []);
  });
}

for (const [label, options] of [
  ["revision", { liveRevision: 8 }],
  ["published pointer", { livePointer: otherId }],
]) {
  test(`unpublish detects a concurrent ${label} change at the transaction boundary`, async () => {
    const { request, state } = scenario(options);
    await assertError(await request(), 409, "staleReport");
    assert.equal(state.transitions.length, 1);
    assert.deepEqual(state.writes, []);
  });
}

for (const [code, message, status, errorKey] of [
  ["55000", "active job", 409, "batchProcessing"],
  ["55000", "report missing", 404, "notFound"],
  ["55000", "version mismatch", 404, "notFound"],
  ["55000", "review required", 409, "reviewPending"],
  ["55000", "approval required", 409, "notApproved"],
  ["XX000", "private SQL failure in report_versions", 500, "serverError"],
]) {
  test(`failed unpublish transaction maps ${message} without partial publication writes`, async () => {
    const { request, state } = scenario({ rpcError: { code, message } });
    const response = await request();
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { errorKey });
    assert.equal(state.transitions.length, 1);
    assert.deepEqual(state.writes, []);
    assert.equal(state.report.current_published_version_id, versionId);
    assert.equal(state.version.status, "published");
    assert.ok(!JSON.stringify(state.logs).includes(message));
  });
}

test("publish uses the database publication timestamp and one transactional transition", async () => {
  const { request, state } = scenario(editableOptions());
  const response = await request("publish", { reportVersionId: versionId, revision: 7, expectedPublishedVersionId: null });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.versionId, versionId);
  assert.equal(body.status, "published");
  assert.equal(body.publishedAt, databaseTimestamp);
  assert.equal(state.report.current_published_version_id, versionId);
  assert.equal(state.transitions.length, 1);
  assert.equal(state.transitions[0].args.p_action, "publish");
  assert.deepEqual(state.writes, []);
});

test("publish rejects a version that has not been approved", async () => {
  const options = editableOptions();
  options.version.status = "draft";
  const { request, state } = scenario(options);
  await assertError(await request("publish"), 409, "notApproved");
  assert.deepEqual(state.transitions, []);
  assert.deepEqual(state.writes, []);
});

for (const [label, metrics, status, errorKey] of [
  ["missing metrics", [], 422, "noMetrics"],
  ["unreviewed metrics", [{ id: otherId, needs_review: true, metric_value: 42 }], 409, "reviewPending"],
]) {
  test(`approve rejects ${label} before any mutation`, async () => {
    const { request, state } = scenario(draftOptions({ metrics }));
    await assertError(await request("approve"), status, errorKey);
    assert.deepEqual(state.transitions, []);
    assert.deepEqual(state.writes, []);
  });
}

test("approve sends a reviewed version through the same transactional boundary", async () => {
  const { request, state } = scenario(draftOptions());
  const response = await request("approve");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "approved");
  assert.equal(state.transitions.length, 1);
  assert.equal(state.transitions[0].args.p_action, "approve");
  assert.deepEqual(state.writes, []);
});

test("approve: an optional summary edit is revision guarded before the transition", async () => {
  const { request, state } = scenario(draftOptions());
  const response = await request("approve", { reportVersionId: versionId, revision: 7, expectedPublishedVersionId: null, summary: "Updated summary" });
  assert.equal(response.status, 200);
  assert.equal(state.writes.length, 1);
  assert.equal(state.version.summary, "Updated summary");
  assert.equal(state.transitions.length, 1);
  assert.equal(state.transitions[0].args.p_revision, 8);
});

test("approve: a concurrent summary edit prevents the transition", async () => {
  const { request, state } = scenario(draftOptions({ summaryConflict: true }));
  await assertError(await request("approve", { reportVersionId: versionId, summary: "Updated summary" }), 409, "staleReport");
  assert.deepEqual(state.transitions, []);
  assert.equal(state.version.summary, "Reviewed summary");
  assert.equal(state.report.current_published_version_id, null);
});

test("publish cannot replace the approved summary with unreviewed content", async () => {
  const { request, state } = scenario(editableOptions());
  await assertError(await request("publish", { reportVersionId: versionId, summary: "Unreviewed summary" }), 409, "versionLocked");
  assert.deepEqual(state.transitions, []);
  assert.deepEqual(state.writes, []);
  assert.equal(state.version.summary, "Reviewed summary");
});

test("publish accepts the approved summary unchanged without an extra write", async () => {
  const { request, state } = scenario(editableOptions());
  const response = await request("publish", { reportVersionId: versionId, summary: "Reviewed summary" });
  assert.equal(response.status, 200);
  assert.equal(state.transitions.length, 1);
  assert.deepEqual(state.writes, []);
});
