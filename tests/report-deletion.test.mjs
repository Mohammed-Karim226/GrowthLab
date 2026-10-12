import assert from "node:assert/strict";
import { test } from "node:test";
import { appLoader } from "./helpers/app-loader.mjs";

const actorId = "33a45d0d-366a-424d-819d-b20b5a228697";
const reportId = "ea30d44e-3217-4dc7-bb27-f278aa41780d";
const otherId = "626d0a49-fae0-46bd-8b12-0536e6c7d48d";
const logging = appLoader()("src/lib/security/logging.ts");

function scenario(options = {}) {
  const state = { role: "admin", errors: [], result: { report_id: reportId }, ...options, calls: [], logs: [] };
  const db = {
    auth: { getUser: async () => ({ data: { user: state.role ? { id: actorId } : null }, error: null }) },
    from(table) {
      assert.equal(table, "profiles", "Report deletion must cross the transaction boundary");
      const query = {
        select() { return query; },
        eq() { return query; },
        async maybeSingle() { return { data: { id: actorId, role: state.role, client_id: null }, error: null }; },
      };
      return query;
    },
    async rpc(name, args) {
      assert.equal(name, "delete_report");
      assert.deepEqual(args, { p_report: reportId });
      state.calls.push("transaction");
      const error = state.errors.shift();
      if (error) return { data: null, error };
      return { data: state.result, error: null };
    },
  };
  const load = appLoader({
    "@/lib/supabase/server": { createClient: async () => db },
    "@/lib/reports/deletion-cleanup": {
      async cleanupReportDeletion(id) {
        assert.equal(id, reportId);
        assert.equal(state.calls.at(-1), "transaction", "External cleanup must follow the committed deletion");
        state.calls.push("cleanup");
        if (state.cleanupError) throw state.cleanupError;
      },
    },
    "@/lib/security/logging": { ...logging, logEvent: (event) => state.logs.push(event) },
  });
  return {
    state,
    request(id = reportId) {
      return load("src/app/api/admin/reports/[reportId]/route.ts").DELETE(
        new Request(`http://localhost/api/admin/reports/${id}`, { method: "DELETE" }),
        { params: Promise.resolve({ reportId: id }) }
      );
    },
  };
}

for (const role of [null, "client"]) {
  test(`report deletion rejects ${role ?? "anonymous"} without side effects`, async () => {
    const { state, request } = scenario({ role });
    assert.equal((await request()).status, 401);
    assert.deepEqual(state.calls, []);
  });
}

test("invalid report identifier cannot reach deletion or cleanup", async () => {
  const { state, request } = scenario();
  assert.equal((await request("invalid")).status, 404);
  assert.deepEqual(state.calls, []);
});

test("successful deletion cleans external resources only after the transaction", async () => {
  const { state, request } = scenario();
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: reportId, cleanupPending: false });
  assert.deepEqual(state.calls, ["transaction", "cleanup"]);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("external cleanup failure reports pending work without undoing report deletion", async () => {
  const { state, request } = scenario({ cleanupError: { code: "STORAGE_UNAVAILABLE", message: "private detail" } });
  const response = await request();
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { deleted: reportId, cleanupPending: true });
  assert.deepEqual(state.calls, ["transaction", "cleanup"]);
  assert.ok(state.logs.some((event) => event.operation === "deleteReport:cleanup" && event.outcome === "pending"));
  assert.ok(!JSON.stringify(state.logs).includes("private detail"));
});

for (const [code, message, status, errorKey] of [
  ["55000", "published report", 409, "publishedReportDelete"],
  ["55000", "report missing", 404, "notFound"],
  ["40001", "concurrent update", 409, "staleReport"],
  ["42501", "private permission detail", 500, "serverError"],
  ["XX000", "private SQL detail", 500, "serverError"],
]) {
  test(`deletion failure ${code}/${message} never removes files or cancels jobs`, async () => {
    const { state, request } = scenario({ errors: [{ code, message }] });
    const response = await request();
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { errorKey });
    assert.deepEqual(state.calls, ["transaction"]);
  });
}

test("a rolled-back deadlock can retry before any external cleanup", async () => {
  const { state, request } = scenario({ errors: [{ code: "40P01" }, { code: "40P01" }] });
  assert.equal((await request()).status, 200);
  assert.deepEqual(state.calls, ["transaction", "transaction", "transaction", "cleanup"]);
});

test("persistent deadlocks stop after three attempts without external cleanup", async () => {
  const { state, request } = scenario({ errors: Array.from({ length: 3 }, () => ({ code: "40P01" })) });
  const response = await request();
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { errorKey: "staleReport" });
  assert.deepEqual(state.calls, ["transaction", "transaction", "transaction"]);
});

for (const result of [null, { report_id: otherId }]) {
  test(`missing or mismatched cleanup manifest cannot trigger external deletion: ${JSON.stringify(result)}`, async () => {
    const { state, request } = scenario({ result });
    assert.equal((await request()).status, 500);
    assert.deepEqual(state.calls, ["transaction"]);
  });
}

function sweepScenario(options = {}) {
  const state = { tasks: [{ report_id: reportId }, { report_id: otherId }], ...options, reads: [], cleanup: [], logs: [], steps: [] };
  const load = appLoader({
    "@/lib/inngest/client": { inngest: { createFunction: (config, handler) => ({ config, handler }) } },
    "@/lib/supabase/admin": {
      createAdminClient: () => ({
        from(table) {
          assert.equal(table, "report_deletion_cleanup");
          const call = { filters: [], order: [] };
          state.reads.push(call);
          const query = {
            delete() { call.delete = true; return query; },
            select(columns) { call.select = columns; return query; },
            not(...args) { call.filters.push(["not", ...args]); return query; },
            lt(...args) { call.filters.push(["lt", ...args]); return query; },
            order(...args) { call.order.push(args); return query; },
            limit(value) { call.limit = value; return query; },
            then(resolve, reject) {
              return Promise.resolve({
                data: call.delete ? null : state.tasks,
                error: call.delete ? state.retireError ?? null : state.readError ?? null,
              }).then(resolve, reject);
            },
          };
          return query;
        },
      }),
    },
    "@/lib/reports/deletion-cleanup": { async cleanupReportDeletion(id) {
      state.cleanup.push(id);
      if (id === state.failedReport) throw { code: "STORAGE_UNAVAILABLE" };
    } },
    "@/lib/security/logging": { ...logging, logEvent: (event) => state.logs.push(event) },
  });
  const fn = load("src/lib/inngest/report-cleanup.ts").cleanupDeletedReports;
  return {
    state, config: fn.config,
    run: () => fn.handler({ step: { async run(name, work) { state.steps.push(name); return work(); } } }),
  };
}

test("periodic cleanup recovers committed deletions whose requests never dispatched cleanup", async () => {
  const { state, config, run } = sweepScenario();
  assert.deepEqual(config.triggers, [{ cron: "*/5 * * * *" }]);
  assert.equal(config.concurrency, 1);
  assert.deepEqual(await run(), { checked: 2, pending: 0 });
  assert.deepEqual(state.cleanup, [reportId, otherId]);
  const [retire, read] = state.reads;
  assert.deepEqual(retire.filters[0], ["not", "completed_at", "is", null]);
  assert.equal(retire.filters[1][1], "created_at");
  assert.ok(Date.parse(retire.filters[1][2]) <= Date.now() - 23 * 60 * 60 * 1000);
  assert.equal(read.limit, 25);
  assert.deepEqual(read.order[0], ["last_attempt_at", { ascending: true, nullsFirst: true }]);
});

test("one failed cleanup cannot prevent other reports from being cleaned", async () => {
  const { state, run } = sweepScenario({ failedReport: reportId });
  assert.deepEqual(await run(), { checked: 2, pending: 1 });
  assert.deepEqual(state.cleanup, [reportId, otherId]);
  assert.equal(state.logs[0].entityId, reportId);
});

for (const key of ["retireError", "readError"]) {
  test(`cleanup worker surfaces ${key} without losing task recovery`, async () => {
    const { state, run } = sweepScenario({ [key]: { code: "XX000" } });
    await assert.rejects(run(), (error) => error.code === "XX000");
    assert.deepEqual(state.cleanup, []);
  });
}
