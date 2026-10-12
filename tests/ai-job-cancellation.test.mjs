import assert from "node:assert/strict";
import { test } from "node:test";
import { appLoader } from "./helpers/app-loader.mjs";

const jobId = "33a45d0d-366a-424d-819d-b20b5a228697";
const batchId = "ea30d44e-3217-4dc7-bb27-f278aa41780d";
const versionId = "e61a14eb-3669-4615-a601-f33c1d0495ee";
const imageId = "626d0a49-fae0-46bd-8b12-0536e6c7d48d";
const analysisId = "9d529864-e8c7-4f42-97b5-011607098ab3";
const baseLoad = appLoader();
const schemas = baseLoad("src/lib/ai/schemas.ts");
const prompts = baseLoad("src/lib/ai/prompts.ts");
const provider = baseLoad("src/lib/ai/provider.ts");
const extraction = {
  platform: "instagram",
  metrics: [{ metric_name: "views", value: 42, unit: "count", confidence: 0.95 }],
  unreadable: [],
};
const expectedResult = { total: 1, needsReview: 0, unreadable: [] };

function deleteReport(state) {
  state.job = null;
  state.batch = null;
  state.analyses = [];
  state.metrics = [];
  state.deleted = true;
}

// Run the actual worker, image loader, extraction validation and retry logic.
// Only the Inngest scheduler, Supabase I/O and provider transport are replaced.
function scenario(options = {}) {
  const state = {
    job: {
      id: jobId,
      insight_batch_id: batchId,
      status: "queued",
      attempts: 0,
      started_at: null,
      requested_by: imageId,
      result: null,
    },
    batch: {
      id: batchId,
      platform: "instagram",
      notes: null,
      status: "processing",
      report_version_id: versionId,
      report_versions: { status: "draft" },
      insight_images: [{ id: imageId, storage_path: "report/screenshot.png", mime_type: "image/png", sort_order: 0 }],
    },
    analyses: [],
    metrics: [{ insight_batch_id: batchId, source: "manual", metric_name: "followers", metric_value: 15 }],
    completion: extraction,
    ...options,
    operations: [],
    mutations: [],
    downloads: [],
    completions: [],
    steps: [],
    cachedSteps: new Map(options.cachedSteps ?? []),
  };
  const supabase = {
    from(table) {
      const operation = { table, kind: "select", filters: {}, included: {}, columns: null, values: null, single: false };
      let pending;
      const matches = (row) => row && Object.entries(operation.filters).every(([key, value]) => row[key] === value)
        && Object.entries(operation.included).every(([key, values]) => values.includes(row[key]));
      function execute() {
        if (pending) return pending;
        pending = Promise.resolve().then(async () => {
          await state.beforeOperation?.(operation, state);
          state.operations.push(structuredClone(operation));
          const injectedError = state.databaseError?.(operation, state);
          if (injectedError) return { data: null, error: injectedError };
          if (operation.kind === "insert") {
            assert.ok(["ai_analyses", "metrics"].includes(table));
            if (!state.batch) return { data: null, error: { code: "23503", message: "parent batch deleted" } };
            const values = table === "ai_analyses" ? { id: analysisId, ...operation.values } : operation.values;
            if (table === "ai_analyses") state.analyses.push(values);
            else state.metrics.push(...values);
            state.mutations.push(structuredClone(operation));
            return { data: structuredClone(values), error: null };
          }
          if (table === "ai_jobs" || table === "insight_batches") {
            const key = table === "ai_jobs" ? "job" : "batch";
            const row = state[key];
            if (!matches(row)) return { data: operation.single ? null : [], error: null };
            if (operation.kind === "update") {
              state[key] = { ...row, ...operation.values };
              state.mutations.push(structuredClone(operation));
            }
            return { data: structuredClone(operation.single ? state[key] : [state[key]]), error: null };
          }
          assert.ok(["ai_analyses", "metrics"].includes(table), `Unexpected table ${table}`);
          const key = table === "ai_analyses" ? "analyses" : "metrics";
          let rows = state[key].filter(matches);
          if (operation.kind === "delete") {
            state[key] = state[key].filter((row) => !matches(row));
            if (rows.length) state.mutations.push(structuredClone(operation));
            rows = [];
          } else if (operation.kind === "update") {
            state[key] = state[key].map((row) => matches(row) ? { ...row, ...operation.values } : row);
            if (rows.length) state.mutations.push(structuredClone(operation));
            rows = state[key].filter((row) => rows.some((old) => old.id === row.id));
          }
          if (operation.kind === "select" && table === "ai_analyses") {
            rows.sort((a, b) => b.attempt - a.attempt);
            if (operation.limit) rows = rows.slice(0, operation.limit);
          }
          return { data: structuredClone(operation.single ? rows[0] ?? null : rows), error: null };
        });
        return pending;
      }
      const query = {
        select(columns) { operation.columns = columns; return query; },
        eq(column, value) { operation.filters[column] = value; return query; },
        in(column, values) { operation.included[column] = values; return query; },
        order() { return query; },
        limit(value) { operation.limit = value; return query; },
        update(values) { operation.kind = "update"; operation.values = values; return query; },
        insert(values) { operation.kind = "insert"; operation.values = values; return query; },
        delete() { operation.kind = "delete"; return query; },
        maybeSingle() { operation.single = true; return execute(); },
        single() { operation.single = true; return execute(); },
        then(resolve, reject) { return execute().then(resolve, reject); },
      };
      return query;
    },
    storage: {
      from() {
        return {
          async download(path) {
            state.downloads.push(path);
            await state.duringDownload?.(state);
            if (!state.batch || state.downloadError) return { data: null, error: state.downloadError ?? { message: "Object removed" } };
            return { data: new Blob(["test screenshot"], { type: "image/png" }), error: null };
          },
        };
      },
    },
  };
  let registered;
  const load = appLoader({
    "@/lib/supabase/admin": { createAdminClient: () => supabase },
    "@/lib/inngest/client": {
      inngest: { createFunction(config, handler) { registered = { config, handler }; return registered; } },
    },
    "@/lib/ai/provider": provider,
    "./provider": provider,
    "@/lib/ai": {
      ...schemas,
      ...prompts,
      getAiProvider: () => ({
        name: "test",
        model: "test",
        async complete(input) {
          state.completions.push(input);
          await state.duringCompletion?.(state);
          if (state.providerError) throw state.providerError;
          return { json: state.completion, raw: JSON.stringify(state.completion), model: "test", provider: "test" };
        },
      }),
    },
  });
  const { processAiInsights } = load("src/lib/inngest/functions.ts");
  const { processAiJob } = load("src/lib/ai/process-job.ts");
  return {
    state,
    config: processAiInsights.config,
    process: (job = structuredClone(state.job)) => processAiJob(job),
    run() {
      return processAiInsights.handler({
        event: { data: { jobId, insightBatchId: batchId } },
        step: {
          async run(name, work) {
            state.steps.push(name);
            await state.beforeStep?.(name, state);
            if (state.cachedSteps.has(name)) return structuredClone(state.cachedSteps.get(name));
            const result = await work();
            state.cachedSteps.set(name, structuredClone(result));
            return result;
          },
        },
      });
    },
    fail() {
      return registered.config.onFailure({
        event: { data: { event: { data: { jobId } } } },
        error: new Error("Provider exhausted retries"),
      });
    },
  };
}

function assertNoFailedWork(state) {
  assert.ok(!state.mutations.some((operation) => ["failed", "dead_letter"].includes(operation.values?.status)));
}

test("the worker cancels only the matching job when a deletion event arrives", () => {
  const { config } = scenario();
  assert.deepEqual(config.cancelOn, [{ event: "ai/insights.cancelled", if: "event.data.jobId == async.data.jobId" }]);
  assert.deepEqual(config.triggers, [{ event: "ai/insights.requested" }]);
});

test("a deleted queued job exits successfully without provider calls or mutations", async () => {
  const { run, state } = scenario({ job: null });
  assert.deepEqual(await run(), { cancelled: true });
  assert.deepEqual(state.steps, ["load-job"]);
  assert.deepEqual(state.mutations, []);
  assert.deepEqual(state.completions, []);
});

for (const status of ["completed", "failed", "dead_letter"]) {
  test(`a ${status} job cannot be restarted`, async () => {
    const { run, state } = scenario();
    state.job.status = status;
    state.job.result = expectedResult;
    assert.deepEqual(await run(), status === "completed" ? expectedResult : { cancelled: true });
    assert.deepEqual(state.mutations, []);
    assert.deepEqual(state.completions, []);
  });
}

test("normal processing preserves manual metrics and completes the job, analysis and batch", async () => {
  const { run, state } = scenario();
  assert.deepEqual(await run(), expectedResult);
  assert.equal(state.job.status, "completed");
  assert.equal(state.job.attempts, 1);
  assert.equal(state.batch.status, "needs_review");
  assert.equal(state.analyses[0].status, "completed");
  assert.equal(state.metrics.find((metric) => metric.source === "manual").metric_value, 15);
  assert.equal(state.metrics.find((metric) => metric.source === "ai").metric_value, 42);
  assert.equal(state.downloads.length, 1);
  assert.equal(state.completions.length, 1);
  assert.deepEqual(state.job.result, expectedResult);
});

for (const stepName of ["mark-processing", "analyze-batch", "mark-completed"]) {
  test(`deletion before ${stepName} stops the run even when previous steps are cached`, async () => {
    const { run, state } = scenario({
      beforeStep(name, current) {
        if (name === stepName) deleteReport(current);
      },
    });
    state.cachedSteps.set("load-job", structuredClone(state.job));
    if (stepName !== "mark-processing") state.cachedSteps.set("mark-processing", true);
    if (stepName === "mark-completed") state.cachedSteps.set("analyze-batch", expectedResult);
    assert.deepEqual(await run(), { cancelled: true });
    assert.equal(state.job, null);
    assert.deepEqual(state.mutations, []);
    assert.deepEqual(state.completions, []);
    assertNoFailedWork(state);
  });
}

for (const cachedResult of [null, undefined]) {
  test(`an empty legacy mark-processing result (${String(cachedResult)}) still verifies live state`, async () => {
    const { run, state } = scenario({ cachedSteps: [["mark-processing", cachedResult]] });
    state.job.status = "processing";
    assert.deepEqual(await run(), expectedResult);
    assert.equal(state.completions.length, 1);
    assert.equal(state.job.status, "completed");
  });
}

test("a job completed after the cached load cannot be overwritten by mark-processing", async () => {
  const { run, state } = scenario({
    beforeStep(name, current) {
      if (name === "mark-processing") current.job = { ...current.job, status: "completed", result: expectedResult };
    },
  });
  assert.deepEqual(await run(), { cancelled: true });
  assert.equal(state.job.status, "completed");
  assert.deepEqual(state.mutations, []);
  assert.deepEqual(state.completions, []);
});

test("deletion after an analysis starts prevents screenshot downloads", async () => {
  const { process, state } = scenario({
    beforeOperation(operation, current) {
      if (operation.table === "ai_jobs" && current.analyses.length) deleteReport(current);
    },
  });
  assert.equal(await process(), null);
  assert.deepEqual(state.downloads, []);
  assert.deepEqual(state.completions, []);
  assertNoFailedWork(state);
});

test("deletion during a screenshot download ends quietly without an AI attempt", async () => {
  const { process, state } = scenario({ duringDownload: deleteReport });
  assert.equal(await process(), null);
  assert.equal(state.downloads.length, 1);
  assert.deepEqual(state.completions, []);
  assertNoFailedWork(state);
});

for (const outcome of ["success", "retryable failure"]) {
  test(`deletion during an in-flight provider ${outcome} prevents metric writes, retries and failure records`, async () => {
    const { run, state } = scenario({
      duringCompletion: deleteReport,
      ...(outcome === "retryable failure" ? { providerError: new provider.AiProviderError("network", "Disconnected") } : {}),
    });
    assert.deepEqual(await run(), { cancelled: true });
    assert.equal(state.completions.length, 1);
    assert.equal(state.job, null);
    assert.deepEqual(state.metrics, []);
    assert.ok(!state.operations.some((operation) => operation.table === "metrics"));
    assert.ok(!state.steps.includes("mark-completed"));
    assertNoFailedWork(state);
  });
}

test("provider retry backoff rechecks the job before another paid attempt", async () => {
  const { process, state } = scenario({
    duringCompletion(current) { setTimeout(() => deleteReport(current), 10); },
    providerError: new provider.AiProviderError("rate_limit", "Rate limited"),
  });
  assert.equal(await process(), null);
  assert.equal(state.completions.length, 1);
  assertNoFailedWork(state);
});

for (const table of ["ai_analyses", "metrics"]) {
  test(`a deletion racing the ${table} insert is handled through the foreign-key guard`, async () => {
    const { process, state } = scenario({
      beforeOperation(operation, current) {
        if (operation.table === table && operation.kind === "insert") deleteReport(current);
      },
    });
    assert.equal(await process(), null);
    assert.equal(state.job, null);
    assert.deepEqual(state.analyses, []);
    assert.deepEqual(state.metrics, []);
    assertNoFailedWork(state);
  });
}

test("a real provider failure still records a failed analysis and rejects", async () => {
  const failure = new provider.AiProviderError("auth", "Invalid provider credential");
  const { process, state } = scenario({ providerError: failure });
  await assert.rejects(process(), (error) => error === failure);
  assert.equal(state.analyses[0].status, "failed");
  assert.equal(state.completions.length, 1);
  assert.equal(state.metrics.length, 1);
});

test("model schema errors still fail without replacing existing metrics", async () => {
  const { process, state } = scenario({ completion: { platform: "instagram", metrics: "invalid" } });
  await assert.rejects(process(), /Schema mismatch/);
  assert.equal(state.analyses[0].status, "failed");
  assert.equal(state.metrics.length, 1);
});

for (const table of ["ai_jobs", "insight_batches", "ai_analyses", "metrics"]) {
  test(`a real ${table} database failure is not mistaken for cancellation`, async () => {
    const failure = { code: "42501", message: "Permission denied" };
    const { process } = scenario({
      databaseError(operation) { return operation.table === table ? failure : null; },
    });
    await assert.rejects(process(), (error) => error === failure);
  });
}

test("an unrelated database failure remains an error even if deletion also occurs", async () => {
  const failure = { code: "42501", message: "Permission denied" };
  const { process } = scenario({
    beforeOperation(operation, current) {
      if (operation.table === "metrics" && operation.kind === "insert") deleteReport(current);
    },
    databaseError(operation) { return operation.table === "metrics" && operation.kind === "insert" ? failure : null; },
  });
  await assert.rejects(process(), (error) => error === failure);
});

for (const status of [null, "completed", "failed", "dead_letter"]) {
  test(`onFailure ignores a ${status ?? "deleted"} job and preserves the batch`, async () => {
    const { fail, state } = scenario();
    if (status === null) state.job = null;
    else state.job.status = status;
    await fail();
    assert.deepEqual(state.mutations, []);
    assert.equal(state.batch.status, "processing");
  });
}

for (const outcome of ["deleted", "completed"]) {
  test(`onFailure cannot overwrite a job ${outcome} after its initial lookup`, async () => {
    const { fail, state } = scenario({
      beforeOperation(operation, current) {
        if (operation.table === "ai_jobs" && operation.kind === "update") {
          if (outcome === "deleted") current.job = null;
          else current.job.status = "completed";
        }
      },
    });
    await fail();
    assert.deepEqual(state.mutations, []);
    assert.equal(state.batch.status, "processing");
    assert.ok(!state.operations.some((operation) => operation.table === "insight_batches"));
  });
}

test("onFailure records an active job's final error and marks its processing batch failed", async () => {
  const { fail, state } = scenario();
  state.job.status = "processing";
  await fail();
  assert.equal(state.job.status, "dead_letter");
  assert.equal(state.job.error_key, "aiFailed");
  assert.equal(state.batch.status, "failed");
});

test("onFailure surfaces a database error instead of silently losing the failure", async () => {
  const failure = { code: "08006", message: "Connection lost" };
  const { fail } = scenario({ databaseError: () => failure });
  await assert.rejects(fail(), (error) => error === failure);
});
