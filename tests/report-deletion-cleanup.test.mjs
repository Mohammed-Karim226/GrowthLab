import assert from "node:assert/strict";
import { test } from "node:test";
import { appLoader } from "./helpers/app-loader.mjs";

const reportId = "58452a5c-e560-4ac5-966e-7a38545f6d52";
const clientId = "fbdfc0bf-4036-4ad2-af22-a8fbb8f06109";
const otherReportId = "726733a6-e4d8-4f71-a010-e26f95d510c5";
const prefix = `clients/${clientId}/reports/${reportId}`;
const jobId = (index) => `d370e336-82d8-4ec1-8c86-${String(index).padStart(12, "0")}`;

function scenario(options = {}) {
  const initialTask = {
    report_id: reportId, storage_prefix: prefix, storage_paths: [], job_ids: [jobId(1)],
    created_at: "2026-10-11T00:00:00.000Z", last_attempt_at: null,
    storage_cleaned_at: null, jobs_cancelled_at: null, completed_at: null,
    ...options.task,
  };
  const state = {
    task: options.missing ? null : structuredClone(initialTask),
    objects: new Set(options.objects ?? []), calls: [], eventBatches: [], removals: [], lists: [],
    sendError: options.sendError, storageError: options.storageError,
    readError: options.readError, updateError: options.updateError,
  };

  const storage = {
    async remove(paths) {
      state.calls.push({ kind: "remove", paths: [...paths] });
      state.removals.push([...paths]);
      const error = typeof state.storageError === "function" ? state.storageError("remove", paths) : state.storageError;
      if (error) return { error };
      if (!options.noProgress) for (const path of paths) state.objects.delete(path);
      return { data: [], error: null };
    },
    async list(directory, pagination) {
      state.calls.push({ kind: "list", directory });
      state.lists.push({ directory, ...pagination });
      const error = typeof state.storageError === "function" ? state.storageError("list", directory) : state.storageError;
      if (error) return { data: null, error };
      if (options.listEntries) return { data: options.listEntries(directory), error: null };
      const children = new Map();
      for (const object of state.objects) {
        if (!object.startsWith(`${directory}/`)) continue;
        const relative = object.slice(directory.length + 1);
        const [name, ...descendants] = relative.split("/");
        children.set(name, { name, id: descendants.length ? null : `object:${object}` });
      }
      const data = [...children.values()].sort((a, b) => a.name.localeCompare(b.name));
      return { data: data.slice(pagination.offset, pagination.offset + pagination.limit), error: null };
    },
  };

  function from(table) {
    assert.equal(table, "report_deletion_cleanup", "Cleanup must use the durable task, never live report rows");
    const operation = { filters: {}, values: null };
    const query = {
      select() { return query; },
      eq(column, value) { operation.filters[column] = value; return query; },
      is(column, value) { operation.filters[column] = value; return query; },
      update(values) { operation.values = values; return query; },
      async maybeSingle() {
        assert.deepEqual(operation.filters, { report_id: reportId });
        state.calls.push({ kind: "read" });
        return { data: state.task ? structuredClone(state.task) : null, error: state.readError };
      },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          assert.equal(operation.filters.report_id, reportId);
          assert.ok(operation.values);
          state.calls.push({ kind: "update", values: { ...operation.values }, filters: { ...operation.filters } });
          const error = state.updateError?.(operation.values);
          if (error) return { error };
          if (options.retireOnAttempt && operation.values.last_attempt_at) state.task = null;
          if (state.task && (!Object.hasOwn(operation.filters, "completed_at") || state.task.completed_at === operation.filters.completed_at)) {
            Object.assign(state.task, operation.values);
          }
          return { error: null };
        }).then(resolve, reject);
      },
    };
    return query;
  }

  const { cleanupReportDeletion } = appLoader({
    "@/lib/supabase/admin": { createAdminClient: () => ({
      from,
      storage: { from(bucket) { assert.equal(bucket, "insights"); return storage; } },
    }) },
    "@/lib/inngest/client": { inngest: { async send(events) {
      state.calls.push({ kind: "cancel" });
      state.eventBatches.push(structuredClone(events));
      const error = typeof state.sendError === "function" ? state.sendError(state.eventBatches.length) : state.sendError;
      if (error) throw error;
      return { ids: events.map((event) => event.id) };
    } } },
  })("src/lib/reports/deletion-cleanup.ts");
  return { state, run: () => cleanupReportDeletion(reportId) };
}

const externalCalls = (state) => state.calls.filter((call) => ["remove", "list", "cancel"].includes(call.kind));

test("missing cleanup task performs no external work or writes", async () => {
  const { state, run } = scenario({ missing: true });
  await run();
  assert.deepEqual(state.calls, [{ kind: "read" }]);
});

test("task read and attempt-record failures prevent external work", async () => {
  for (const failure of ["read", "attempt"]) {
    const error = new Error(`Synthetic ${failure} failure`);
    const { state, run } = scenario(failure === "read" ? { readError: error } : {
      updateError: (values) => values.last_attempt_at ? error : null,
    });
    await assert.rejects(run, (received) => received === error);
    assert.deepEqual(externalCalls(state), []);
  }
});

test("records an attempt before external work and completes only after both stages", async () => {
  const { state, run } = scenario({ objects: [`${prefix}/image.png`] });
  await run();
  assert.equal(state.calls[0].kind, "read");
  assert.ok(state.calls[1].values.last_attempt_at);
  assert.ok(state.task.jobs_cancelled_at);
  assert.ok(state.task.storage_cleaned_at);
  assert.ok(state.task.completed_at);
  const last = state.calls.at(-1);
  assert.ok(last.values.completed_at);
  assert.deepEqual(last.filters, { report_id: reportId, completed_at: null });
  assert.deepEqual(state.eventBatches, [[{
    name: "ai/insights.cancelled", id: `report-deletion:${reportId}:${jobId(1)}`, data: { jobId: jobId(1) },
  }]]);
});

test("known paths and cancellation events are chunked at 100 with stable event IDs on retry", async () => {
  const knownPaths = Array.from({ length: 205 }, (_, i) => `${prefix}/known-${i}.png`);
  const jobIds = Array.from({ length: 205 }, (_, i) => jobId(i));
  const error = new Error("Second event batch failed");
  const { state, run } = scenario({
    objects: knownPaths, task: { storage_paths: knownPaths, job_ids: [...jobIds, jobIds[0]] },
    sendError: (attempt) => attempt === 2 ? error : null,
  });
  await assert.rejects(run, (received) => received === error);
  assert.deepEqual(state.removals.map((paths) => paths.length), [100, 100, 5]);
  assert.equal(state.task.jobs_cancelled_at, null);
  assert.ok(state.task.storage_cleaned_at);
  assert.equal(state.task.completed_at, null);
  await run();
  assert.deepEqual(state.eventBatches.map((events) => events.length), [100, 100, 100, 100, 5]);
  assert.deepEqual(state.eventBatches[0], state.eventBatches[2]);
  assert.deepEqual(state.eventBatches[1], state.eventBatches[3]);
  assert.ok(state.task.completed_at);
});

test("page-zero sweeps remove multiple pages and virtual folders without touching sibling prefixes", async () => {
  const direct = Array.from({ length: 235 }, (_, i) => `${prefix}/image-${String(i).padStart(3, "0")}.png`);
  const nested = Array.from({ length: 215 }, (_, i) => `${prefix}/version/batch/image-${String(i).padStart(3, "0")}.png`);
  const unrelated = [`clients/${clientId}/reports/${otherReportId}/image.png`, `${prefix}-other/image.png`];
  const { state, run } = scenario({ objects: [...direct, ...nested, ...unrelated], task: { job_ids: [] } });
  await run();
  assert.deepEqual([...state.objects].sort(), unrelated.sort());
  assert.ok(state.removals.every((paths) => paths.length <= 100));
  assert.equal(state.removals.flat().length, direct.length + nested.length);
  assert.ok(state.lists.every((page) => page.offset === 0 && page.limit === 100));
  assert.ok(state.lists.filter((page) => page.directory === prefix).length >= 4);
  assert.ok(state.lists.some((page) => page.directory === `${prefix}/version/batch`));
  assert.deepEqual(state.eventBatches, []);
});

test("a cancellation failure still cleans storage and leaves the task retryable", async () => {
  const error = new Error("Cancellation unavailable");
  const { state, run } = scenario({ sendError: error, objects: [`${prefix}/image.png`] });
  await assert.rejects(run, (received) => received === error);
  assert.equal(state.objects.size, 0);
  assert.ok(state.task.storage_cleaned_at);
  assert.equal(state.task.jobs_cancelled_at, null);
  assert.equal(state.task.completed_at, null);
  state.sendError = null;
  await run();
  assert.ok(state.task.completed_at);
});

test("a storage failure still cancels jobs and retry does not send them again", async () => {
  const error = new Error("Storage unavailable");
  const { state, run } = scenario({ storageError: error, objects: [`${prefix}/image.png`] });
  await assert.rejects(run, (received) => received === error);
  assert.ok(state.task.jobs_cancelled_at);
  assert.equal(state.task.storage_cleaned_at, null);
  assert.equal(state.task.completed_at, null);
  state.storageError = null;
  await run();
  assert.equal(state.eventBatches.length, 1);
  assert.equal(state.objects.size, 0);
  assert.ok(state.task.completed_at);
});

test("completed tasks resweep late uploads while preserving their original completion time", async () => {
  const completed = "2026-10-11T01:00:00.000Z";
  const { state, run } = scenario({ task: {
    jobs_cancelled_at: completed, storage_cleaned_at: completed, completed_at: completed,
  } });
  await run();
  state.objects.add(`${prefix}/late-version/batch/image.png`);
  await run();
  assert.equal(state.objects.size, 0);
  assert.deepEqual(state.eventBatches, []);
  assert.equal(state.task.completed_at, completed);
});

test("a failed resweep clears completion so the durable task is retained", async () => {
  const completed = "2026-10-11T01:00:00.000Z";
  const error = new Error("Late storage failure");
  const { state, run } = scenario({ storageError: error, task: {
    jobs_cancelled_at: completed, storage_cleaned_at: completed, completed_at: completed,
  } });
  await assert.rejects(run, (received) => received === error);
  assert.equal(state.task.completed_at, null);
  assert.equal(state.task.storage_cleaned_at, null);
  assert.equal(state.task.jobs_cancelled_at, completed);
});

test("forged or noncanonical prefixes cannot issue storage requests", async () => {
  for (const storagePrefix of [
    `clients/${clientId}/reports/${otherReportId}`, `${prefix}/`, `${prefix}/../other`,
    `other/${prefix}`, "clients/not-a-uuid/reports/" + reportId,
  ]) {
    const { state, run } = scenario({ task: { storage_prefix: storagePrefix, storage_paths: [`${prefix}/known.png`] } });
    await assert.rejects(run, /Invalid report cleanup storage prefix/);
    assert.deepEqual(state.removals, []);
    assert.deepEqual(state.lists, []);
    assert.ok(state.task.jobs_cancelled_at, "Independent cancellation must still run");
    assert.equal(state.task.completed_at, null);
  }
});

test("listed children cannot escape the validated report prefix", async () => {
  for (const name of ["..", ".", "../other.png", "folder/other.png", "folder\\other.png", "", "image\0.png"]) {
    const { state, run } = scenario({ listEntries: () => [{ name, id: "object-id" }] });
    await assert.rejects(run, /Invalid report cleanup storage entry/);
    assert.deepEqual(state.removals, []);
    assert.equal(state.lists.length, 1);
    assert.equal(state.task.completed_at, null);
  }
});

test("captured legacy paths are removed even outside the canonical prefix", async () => {
  const legacy = "legacy/screenshot.png";
  const { state, run } = scenario({ task: { storage_paths: [legacy] }, objects: [legacy] });
  await run();
  assert.equal(state.objects.size, 0);
  assert.deepEqual(state.removals, [[legacy]]);
});

test("empty captured paths fail storage cleanup without preventing cancellation", async () => {
  const { state, run } = scenario({ task: { storage_paths: [""] } });
  await assert.rejects(run, /Invalid report cleanup storage path/);
  assert.deepEqual(state.removals, []);
  assert.ok(state.task.jobs_cancelled_at);
  assert.equal(state.task.completed_at, null);
});

test("an unchanging storage page fails safely instead of looping forever", async () => {
  const { state, run } = scenario({ noProgress: true, objects: [`${prefix}/image.png`] });
  await assert.rejects(run, /Storage cleanup made no progress/);
  assert.equal(state.lists.length, 2);
  assert.equal(state.task.completed_at, null);
});

test("milestone write errors propagate while the independent stage finishes", async () => {
  for (const field of ["jobs_cancelled_at", "storage_cleaned_at"]) {
    const error = new Error(`Cannot record ${field}`);
    const { state, run } = scenario({
      updateError: (values) => values[field] ? error : null,
      objects: [`${prefix}/image.png`],
    });
    await assert.rejects(run, (received) => received === error);
    assert.equal(state.task[field], null);
    assert.equal(state.task.completed_at, null);
    assert.equal(state.objects.size, 0);
    assert.equal(state.eventBatches.length, 1);
  }
});

test("completion and failure-record database errors are not swallowed", async () => {
  for (const failing of [false, true]) {
    const error = new Error("Cannot update completion");
    const { run } = scenario({
      sendError: failing ? new Error("Cancellation unavailable") : null,
      updateError: (values) => Object.hasOwn(values, "completed_at") ? error : null,
    });
    await assert.rejects(run, (received) => received === error);
  }
});

test("another worker retiring the task makes zero-row updates harmless", async () => {
  const { state, run } = scenario({ retireOnAttempt: true, objects: [`${prefix}/image.png`] });
  await run();
  assert.equal(state.task, null);
  assert.equal(state.objects.size, 0);
  assert.equal(state.eventBatches.length, 1);
});
