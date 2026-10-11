import assert from "node:assert/strict";
import { test } from "node:test";
import { appLoader } from "./helpers/app-loader.mjs";

const actorId = "33a45d0d-366a-424d-819d-b20b5a228697";
const reportId = "ea30d44e-3217-4dc7-bb27-f278aa41780d";
const versionId = "e61a14eb-3669-4615-a601-f33c1d0495ee";
const otherId = "626d0a49-fae0-46bd-8b12-0536e6c7d48d";
const generatedAt = "2026-10-01T10:15:30.000Z";
const summary = {
  summary: "Views increased during the reporting period.",
  went_well: ["The reviewed posts reached more viewers."],
  what_changed: [],
  needs_attention: [],
  recommendations: ["Continue reviewing the performance of these posts."],
};
const originalSummary = { ...summary, summary: "Previously reviewed narrative.", generated_at: generatedAt };
const baseLoad = appLoader();
const schemas = baseLoad("src/lib/ai/schemas.ts");
const prompts = baseLoad("src/lib/ai/prompts.ts");
const provider = baseLoad("src/lib/ai/provider.ts");
const logging = baseLoad("src/lib/security/logging.ts");

function metric(overrides = {}) {
  return {
    id: otherId,
    report_version_id: versionId,
    insight_batch_id: null,
    platform: "instagram",
    metric_name: "views",
    metric_value: 42,
    metric_unit: "count",
    metric_date: "2026-09-30",
    needs_review: false,
    ...overrides,
  };
}

// Keep the real routes, admin authorization, schemas, analytics and prompt.
// Replace Supabase and the AI transport only. The database transaction has its
// own integration checks; this suite verifies the route uses that boundary.
function scenario(options = {}) {
  const state = {
    role: "admin",
    version: {
      id: versionId,
      report_id: reportId,
      status: "draft",
      revision: 7,
      version_number: 2,
      ai_summary: null,
      reports: {
        id: reportId,
        title: "September report",
        client_id: otherId,
        period_start: "2026-09-01",
        period_end: "2026-09-30",
        clients: { name: "Example client" },
      },
    },
    metrics: [metric()],
    previousReport: null,
    previousMetrics: [metric({ metric_value: 21 })],
    completion: summary,
    ...options,
    reads: [],
    writes: [],
    saves: [],
    completions: [],
    logs: [],
  };
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: state.role ? { id: actorId } : null }, error: null }),
      getSession() { assert.fail("Summary authorization must revalidate the user"); },
    },
    from(table) {
      const operation = { table, filters: {}, columns: null, conditions: [] };
      let pending;
      function execute() {
        if (pending) return pending;
        pending = Promise.resolve().then(() => {
          state.reads.push(operation);
          if (table === "profiles") {
            assert.deepEqual(operation.filters, { id: actorId });
            return { data: { id: actorId, role: state.role, client_id: null }, error: null };
          }
          if (state.readError) return { data: null, error: state.readError };
          if (table === "report_versions") {
            assert.equal(operation.filters.id, versionId);
            assert.equal(operation.filters.report_id, reportId);
            assert.match(operation.columns, /\brevision\b/, "The saved revision must come from the loaded snapshot");
            return { data: structuredClone(state.version), error: null };
          }
          if (table === "reports") return { data: structuredClone(state.previousReport), error: state.previousReportError ?? null };
          assert.equal(table, "metrics", `Unexpected table ${table}`);
          const current = operation.filters.report_version_id === versionId;
          if (!current) assert.equal(operation.filters.report_version_id, state.previousReport?.current_published_version_id);
          return {
            data: structuredClone(current ? state.metrics : state.previousMetrics),
            error: (current ? state.metricsError : state.previousMetricsError) ?? null,
          };
        });
        return pending;
      }
      const query = {
        select(columns) { operation.columns = columns; return query; },
        eq(column, value) { operation.filters[column] = value; return query; },
        neq(...args) { operation.conditions.push(["neq", ...args]); return query; },
        not(...args) { operation.conditions.push(["not", ...args]); return query; },
        lt(...args) { operation.conditions.push(["lt", ...args]); return query; },
        order(...args) { operation.conditions.push(["order", ...args]); return query; },
        limit(...args) { operation.conditions.push(["limit", ...args]); return query; },
        update(values) {
          state.writes.push({ table, values });
          assert.fail("Summary and status writes must be atomic inside save_report_summary");
        },
        insert(values) {
          state.writes.push({ table, values });
          assert.fail("The summary transaction must own its audit insert");
        },
        returns() { return query; },
        maybeSingle: execute,
        single: execute,
        then(resolve, reject) { return execute().then(resolve, reject); },
      };
      return query;
    },
    async rpc(name, args) {
      state.saves.push({ name, args: structuredClone(args) });
      assert.equal(name, "save_report_summary");
      assert.deepEqual(Object.keys(args).sort(), ["p_action", "p_metadata", "p_report", "p_revision", "p_summary", "p_version"]);
      assert.equal(args.p_report, reportId);
      assert.equal(args.p_version, versionId);
      if (state.rpcError) return { data: null, error: state.rpcError };
      if (Object.hasOwn(state, "rpcResult")) return { data: state.rpcResult, error: null };
      if (args.p_revision !== state.version.revision) {
        return { data: null, error: { code: "40001", message: "Concurrent report change" } };
      }
      const status = args.p_action === "generate" || state.version.status === "approved"
        ? "needs_review" : state.version.status;
      state.version = {
        ...state.version,
        ai_summary: structuredClone(args.p_summary),
        status,
        revision: state.version.revision + 1,
      };
      return { data: structuredClone(state.version), error: null };
    },
  };
  const load = appLoader({
    "@/lib/supabase/server": { createClient: async () => supabase },
    "@/lib/security/logging": { ...logging, logEvent: (event) => state.logs.push(event) },
    "@/lib/ai/provider": provider,
    "@/lib/ai": {
      ...schemas,
      ...prompts,
      getAiProvider() {
        if (state.providerSetupError) throw state.providerSetupError;
        return {
          async complete(input) {
            state.completions.push(input);
            if (state.duringCompletion) await state.duringCompletion(state);
            if (state.providerError) throw state.providerError;
            return { json: state.completion, raw: JSON.stringify(state.completion), model: "test", provider: "test" };
          },
        };
      },
    },
  });
  return {
    state,
    request(method = "POST", body = defaultBody(method), locale = "ar") {
      const route = load("src/app/api/admin/reports/[reportId]/summary/route.ts");
      return route[method](new Request(`http://localhost/api/admin/reports/${reportId}/summary?locale=${locale}`, {
        method,
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }), { params: Promise.resolve({ reportId }) });
    },
  };
}

function defaultBody(method, overrides = {}) {
  return { reportVersionId: versionId, ...(method === "PATCH" ? { summary } : {}), ...overrides };
}

async function assertError(response, status, errorKey) {
  assert.equal(response.status, status);
  assert.equal((await response.json()).errorKey, errorKey);
}

function assertUntouched(state) {
  assert.deepEqual(state.writes, []);
  assert.deepEqual(state.saves, []);
}

for (const method of ["POST", "PATCH"]) {
  for (const status of ["draft", "needs_review", "approved"]) {
    test(`${method}: saves ${status} summary through one revision-guarded transaction`, async () => {
      const { request, state } = scenario();
      state.version.status = status;
      if (method === "PATCH") state.version.ai_summary = originalSummary;
      const before = Date.now();
      const response = await request(method, defaultBody(method, { revision: 7 }));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = await response.json();
      const expectedStatus = method === "POST" || status === "approved" ? "needs_review" : status;
      assert.equal(body.status, expectedStatus);
      assert.equal(body.revision, 8);
      assert.equal(state.version.status, expectedStatus);
      assert.deepEqual(body.aiSummary, state.version.ai_summary);
      assert.deepEqual({ ...body.aiSummary, generated_at: undefined }, { ...summary, generated_at: undefined });
      if (method === "PATCH") {
        assert.equal(body.aiSummary.generated_at, generatedAt, "Editing preserves the original generation time");
        assert.deepEqual(state.completions, []);
      } else {
        assert.ok(Date.parse(body.aiSummary.generated_at) >= before);
        assert.ok(Date.parse(body.aiSummary.generated_at) <= Date.now());
        assert.equal(body.metricsUsed, 1);
        assert.equal(body.comparedAgainst, null);
        assert.equal(state.completions.length, 1);
        assert.match(state.completions[0].prompt, /Modern Standard Arabic/);
      }
      assert.equal(state.saves.length, 1);
      assert.equal(state.saves[0].args.p_revision, 7);
      assert.equal(state.saves[0].args.p_action, method === "POST" ? "generate" : "edit");
      assert.deepEqual(state.saves[0].args.p_summary, body.aiSummary);
      assert.deepEqual(state.writes, [], "Neither a direct status write nor a separate audit insert is allowed");
    });
  }

  for (const role of [null, "client"]) {
    test(`${method}: ${role ?? "anonymous"} callers cannot read or change summaries`, async () => {
      const { request, state } = scenario({ role });
      await assertError(await request(method), 401, "unauthorized");
      assert.ok(state.reads.every((read) => read.table === "profiles"));
      assert.deepEqual(state.completions, []);
      assertUntouched(state);
    });
  }

  for (const [label, body, status, errorKey] of [
    ["malformed JSON", "{", 400, "invalidJson"],
    ["missing version", {}, 422, "validationFailed"],
    ["invalid version", defaultBody(method, { reportVersionId: "invalid" }), 422, "validationFailed"],
    ["negative revision", defaultBody(method, { revision: -1 }), 422, "validationFailed"],
    ["fractional revision", defaultBody(method, { revision: 1.5 }), 422, "validationFailed"],
    ["unexpected fields", defaultBody(method, { status: "approved" }), 422, "validationFailed"],
  ]) {
    test(`${method}: rejects ${label} before accessing report data`, async () => {
      const { request, state } = scenario();
      await assertError(await request(method, body), status, errorKey);
      assert.ok(state.reads.every((read) => read.table === "profiles"));
      assert.deepEqual(state.completions, []);
      assertUntouched(state);
    });
  }

  for (const status of ["published", "archived"]) {
    test(`${method}: ${status} versions cannot be edited or sent to AI`, async () => {
      const { request, state } = scenario();
      state.version.status = status;
      await assertError(await request(method), 409, "versionLocked");
      assert.equal(state.version.status, status);
      assert.deepEqual(state.completions, []);
      assertUntouched(state);
    });
  }

  test(`${method}: rejects a version belonging to a different report`, async () => {
    const { request, state } = scenario();
    state.version.report_id = otherId;
    await assertError(await request(method), 404, "notFound");
    assert.deepEqual(state.completions, []);
    assertUntouched(state);
  });

  test(`${method}: returns notFound for a missing version`, async () => {
    const { request, state } = scenario({ version: null });
    await assertError(await request(method), 404, "notFound");
    assert.deepEqual(state.completions, []);
    assertUntouched(state);
  });

  test(`${method}: rejects an outdated editor revision before generating or saving`, async () => {
    const { request, state } = scenario();
    await assertError(await request(method, defaultBody(method, { revision: 6 })), 409, "staleReport");
    assert.equal(state.version.revision, 7);
    assert.deepEqual(state.completions, []);
    assertUntouched(state);
  });

  for (const rpcResult of [null, { id: versionId, ai_summary: null }]) {
    test(`${method}: an empty transaction result cannot be reported as a successful save (${rpcResult ? "missing summary" : "missing row"})`, async () => {
      const { request, state } = scenario({ rpcResult });
      await assertError(await request(method), 500, "serverError");
      assert.equal(state.saves.length, 1);
      assert.deepEqual(state.writes, []);
    });
  }

  for (const [code, message, status, errorKey] of [
    ["40001", "Concurrent report change", 409, "staleReport"],
    ["55000", "active job", 409, "batchProcessing"],
    ["55000", "report missing", 404, "notFound"],
    ["55000", "version mismatch", 404, "notFound"],
    ["55000", "version locked", 409, "versionLocked"],
    ["42501", "private permission failure in report_versions", 500, "serverError"],
    ["XX000", "private SQL failure in audit_logs", 500, "serverError"],
  ]) {
    test(`${method}: transaction error ${message} returns a safe response without partial writes`, async () => {
      const { request, state } = scenario({ rpcError: { code, message } });
      state.version.status = "approved";
      state.version.ai_summary = originalSummary;
      const response = await request(method, defaultBody(method, method === "POST" ? { force: true } : {}));
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), { errorKey });
      assert.equal(state.saves.length, 1);
      assert.deepEqual(state.writes, []);
      assert.equal(state.version.status, "approved");
      assert.deepEqual(state.version.ai_summary, originalSummary);
      assert.equal(state.version.revision, 7);
      assert.ok(!JSON.stringify(state.logs).includes(message));
    });
  }
}

test("POST: refuses to replace an existing narrative without force", async () => {
  const { request, state } = scenario();
  state.version.ai_summary = originalSummary;
  await assertError(await request(), 409, "summaryExists");
  assert.deepEqual(state.completions, []);
  assert.deepEqual(state.version.ai_summary, originalSummary);
  assertUntouched(state);
});

test("POST: force replaces an existing narrative and records regeneration metadata", async () => {
  const { request, state } = scenario();
  state.version.ai_summary = originalSummary;
  const response = await request("POST", defaultBody("POST", { force: true }));
  assert.equal(response.status, 200);
  assert.deepEqual(state.saves[0].args.p_metadata, {
    locale: "ar", metrics_used: 1, compared_against: null, regenerated: true,
  });
  assert.equal(state.version.status, "needs_review");
  assert.equal(state.version.ai_summary.summary, summary.summary);
  assert.notEqual(state.version.ai_summary.generated_at, generatedAt);
  assert.deepEqual(state.writes, []);
});

for (const [label, metrics] of [
  ["empty metrics", []],
  ["only unreviewed metrics", [metric({ needs_review: true })]],
  ["only unreadable metrics", [metric({ metric_value: null })]],
]) {
  test(`POST: ${label} cannot generate a summary`, async () => {
    const { request, state } = scenario({ metrics });
    await assertError(await request(), 422, "noMetrics");
    assert.deepEqual(state.completions, []);
    assertUntouched(state);
  });
}

test("POST: only settled metrics reach AI and the comparison uses the previous published period", async () => {
  const { request, state } = scenario({
    metrics: [metric(), metric({ metric_name: "reach", metric_value: 987654, needs_review: true }), metric({ metric_name: "followers", metric_value: null })],
    previousReport: {
      id: otherId,
      title: "August report",
      period_start: "2026-08-01",
      period_end: "2026-08-31",
      current_published_version_id: otherId,
    },
  });
  const response = await request();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.metricsUsed, 1);
  assert.ok(body.comparedAgainst);
  const prompt = state.completions[0].prompt;
  assert.ok(!prompt.includes("987654"));
  assert.match(prompt, /"views":42/);
  assert.match(prompt, /"views":"\+100%"/);
  assert.equal(state.saves[0].args.p_metadata.compared_against, otherId);
  const previous = state.reads.find((read) => read.table === "reports");
  assert.equal(previous.filters.client_id, otherId);
  assert.ok(previous.conditions.some((condition) => JSON.stringify(condition) === JSON.stringify(["not", "current_published_version_id", "is", null])));
  assert.ok(previous.conditions.some((condition) => JSON.stringify(condition) === JSON.stringify(["lt", "period_end", "2026-09-01"])));
  assert.deepEqual(state.writes, []);
});

for (const [label, completion] of [
  ["missing required sections", { summary: "Incomplete narrative" }],
  ["model-supplied generation timestamp", { ...summary, generated_at: generatedAt }],
]) {
  test(`POST: ${label} fails validation while preserving an approved summary`, async (t) => {
    t.mock.method(console, "error", () => {});
    const { request, state } = scenario({ completion });
    state.version.status = "approved";
    state.version.ai_summary = originalSummary;
    await assertError(await request("POST", defaultBody("POST", { force: true })), 502, "aiBadResponse");
    assert.equal(state.version.status, "approved");
    assert.deepEqual(state.version.ai_summary, originalSummary);
    assertUntouched(state);
  });
}

for (const key of ["providerError", "providerSetupError"]) {
  test(`POST: ${key} does not reopen an approved report or erase its summary`, async (t) => {
    t.mock.method(console, "error", () => {});
    const { request, state } = scenario({ [key]: new provider.AiProviderError("auth", "Private provider credential error") });
    state.version.status = "approved";
    state.version.ai_summary = originalSummary;
    const response = await request("POST", defaultBody("POST", { force: true }));
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { errorKey: "aiFailed" });
    assert.equal(state.version.status, "approved");
    assert.deepEqual(state.version.ai_summary, originalSummary);
    assertUntouched(state);
  });
}

test("POST: a concurrent edit during AI generation is preserved and the outdated result is rejected", async () => {
  const newerSummary = { ...originalSummary, summary: "Newer human edit while AI was running." };
  const { request, state } = scenario({
    duringCompletion(current) {
      current.version = { ...current.version, revision: 8, ai_summary: newerSummary };
    },
  });
  await assertError(await request(), 409, "staleReport");
  assert.equal(state.saves.length, 1);
  assert.equal(state.saves[0].args.p_revision, 7, "Use the revision before generation, not the latest revision");
  assert.equal(state.version.revision, 8);
  assert.deepEqual(state.version.ai_summary, newerSummary);
  assert.deepEqual(state.writes, []);
});

for (const key of ["metricsError", "previousReportError", "previousMetricsError"]) {
  test(`POST: ${key} cannot silently generate a narrative from incomplete data`, async () => {
    const { request, state } = scenario({
      [key]: { code: "42501", message: "Private database read error" },
      previousReport: {
        id: otherId,
        period_start: "2026-08-01",
        period_end: "2026-08-31",
        current_published_version_id: otherId,
      },
    });
    await assertError(await request(), 500, "serverError");
    assert.deepEqual(state.completions, []);
    assertUntouched(state);
  });
}

test("PATCH: invalid client copy fails schema validation before accessing the version", async () => {
  const { request, state } = scenario();
  await assertError(await request("PATCH", defaultBody("PATCH", { summary: { ...summary, summary: "  " } })), 422, "validationFailed");
  assert.ok(state.reads.every((read) => read.table === "profiles"));
  assertUntouched(state);
});

test("PATCH: writing the first narrative stamps a generation time without calling AI", async () => {
  const { request, state } = scenario();
  const before = Date.now();
  const response = await request("PATCH");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(Date.parse(body.aiSummary.generated_at) >= before);
  assert.ok(Date.parse(body.aiSummary.generated_at) <= Date.now());
  assert.equal(body.status, "draft");
  assert.deepEqual(state.completions, []);
  assert.deepEqual(state.writes, []);
});
