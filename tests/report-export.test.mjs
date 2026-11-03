import assert from "node:assert/strict";
import { test } from "node:test";
import { appLoader } from "./helpers/app-loader.mjs";

const actorId = "33a45d0d-366a-424d-819d-b20b5a228697";
const reportId = "ea30d44e-3217-4dc7-bb27-f278aa41780d";
const versionId = "e61a14eb-3669-4615-a601-f33c1d0495ee";
const clientId = "626d0a49-fae0-46bd-8b12-0536e6c7d48d";
const previousReportId = "281bfcf1-d775-4925-bf1b-f59767310f58";
const previousVersionId = "726b3977-e5d2-4c0a-85fe-63163e8e5648";
const pdfBytes = Buffer.from("%PDF-1.7\nExport fixture\n%%EOF");
const logging = appLoader()("src/lib/security/logging.ts");
const aiSummary = {
  summary: "Reviewed executive narrative.",
  went_well: ["Views improved."],
  what_changed: [],
  needs_attention: [],
  recommendations: ["Continue the campaign."],
  generated_at: "2026-10-01T10:00:00.000Z",
};

function metric(overrides = {}) {
  return {
    id: clientId,
    report_version_id: versionId,
    insight_batch_id: "current-batch",
    platform: "instagram",
    metric_name: "views",
    metric_value: 42,
    metric_unit: "count",
    metric_date: "2026-09-30",
    source: "manual",
    confidence: null,
    needs_review: false,
    note: null,
    created_at: "2026-10-01T09:00:00.000Z",
    updated_at: "2026-10-01T09:00:00.000Z",
    insight_batches: {
      account_id: "instagram-account",
      accounts: { page_name: "Main page", page_id: "page-id", stage: "Established" },
    },
    ...overrides,
  };
}

function scenario(options = {}) {
  const state = {
    role: "admin",
    version: {
      id: versionId,
      report_id: reportId,
      version_number: 2,
      revision: 7,
      status: "approved",
      published_at: null,
      summary: "A saved report introduction.",
      ai_summary: aiSummary,
      insight_batches: [],
      reports: {
        id: reportId,
        title: "September performance",
        client_id: clientId,
        current_published_version_id: null,
        period_start: "2026-09-01",
        period_end: "2026-09-30",
        clients: { name: "Example client", company_name: "Example company" },
      },
    },
    previousReport: null,
    previousVersion: {
      id: previousVersionId,
      report_id: previousReportId,
      version_number: 3,
      revision: 11,
      status: "published",
      published_at: "2026-09-01T08:00:00.000Z",
      summary: null,
      ai_summary: null,
      insight_batches: [],
      reports: {
        id: previousReportId,
        title: "August performance",
        client_id: clientId,
        current_published_version_id: previousVersionId,
        period_start: "2026-08-01",
        period_end: "2026-08-31",
        clients: { name: "Example client", company_name: "Example company" },
      },
    },
    metrics: [metric()],
    previousMetrics: [metric({ report_version_id: previousVersionId, insight_batch_id: "previous-batch", metric_value: 21 })],
    ...options,
    reads: [],
    renders: [],
    logs: [],
  };
  const db = {
    auth: {
      getUser: async () => ({ data: { user: state.role ? { id: actorId } : null }, error: null }),
      getSession() { assert.fail("Export authorization must revalidate the user"); },
    },
    from(table) {
      const operation = { table, filters: {}, columns: null, selectOptions: null, conditions: [], range: null };
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
            const current = operation.filters.id === versionId;
            assert.equal(operation.filters.report_id, current ? reportId : previousReportId);
            assert.match(operation.columns, /\brevision\b/);
            assert.match(operation.columns, /reports!report_versions_report_id_fkey/);
            const readNumber = state.reads.filter((read) => read.table === table && read.filters.id === operation.filters.id).length;
            if (readNumber > 1 && state.beforeVersionRecheck) state.beforeVersionRecheck(state, current);
            return { data: structuredClone(current ? state.version : state.previousVersion), error: null };
          }
          if (table === "reports") return { data: structuredClone(state.previousReport), error: state.previousReportError ?? null };
          assert.equal(table, "metrics");
          const current = operation.filters.report_version_id === versionId;
          if (!current) assert.equal(operation.filters.report_version_id, previousVersionId);
          assert.match(operation.columns, /insight_batches!metrics_insight_batch_id_fkey/);
          assert.deepEqual(operation.selectOptions, { count: "exact" });
          assert.deepEqual(operation.conditions, [["order", "id", { ascending: true }]]);
          assert.ok(operation.range, "Metric reads must be paginated");
          const rows = current ? state.metrics : state.previousMetrics;
          const [start, end] = operation.range;
          return {
            data: structuredClone(rows.slice(start, Math.min(end + 1, start + (state.serverRowCap ?? Infinity)))),
            count: rows.length,
            error: (current ? state.metricsError : state.previousMetricsError) ?? null,
          };
        });
        return pending;
      }
      const query = {
        select(columns, settings) { operation.columns = columns; operation.selectOptions = settings; return query; },
        eq(column, value) { operation.filters[column] = value; return query; },
        neq(...args) { operation.conditions.push(["neq", ...args]); return query; },
        not(...args) { operation.conditions.push(["not", ...args]); return query; },
        lt(...args) { operation.conditions.push(["lt", ...args]); return query; },
        order(...args) { operation.conditions.push(["order", ...args]); return query; },
        limit(...args) { operation.conditions.push(["limit", ...args]); return query; },
        range(start, end) { operation.range = [start, end]; return query; },
        returns() { return query; },
        maybeSingle: execute,
        then(resolve, reject) { return execute().then(resolve, reject); },
        insert() { assert.fail("Export is read-only"); },
        update() { assert.fail("Export is read-only"); },
        delete() { assert.fail("Export is read-only"); },
      };
      return query;
    },
  };
  const load = appLoader({
    "@/lib/supabase/server": { createClient: async () => db },
    "@/lib/security/logging": { ...logging, logEvent: (event) => state.logs.push(event) },
    "@/lib/observability/report-error": { reportError: (...args) => state.logs.push(args) },
    "@/lib/reports/export/document": {
      async renderReportPdf(data, settings) {
        state.renders.push({ data: structuredClone(data), options: structuredClone(settings) });
        if (state.renderError) throw state.renderError;
        if (state.renderPdf) return state.renderPdf(data, settings);
        return pdfBytes;
      },
    },
  });
  return {
    state,
    request(body = {}, pathId = reportId) {
      const { POST } = load("src/app/api/admin/reports/[reportId]/export/route.ts");
      return POST(new Request(`http://localhost/api/admin/reports/${pathId}/export`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify({ reportVersionId: versionId, revision: 7, ...body }),
      }), { params: Promise.resolve({ reportId: pathId }) });
    },
  };
}

function withPrevious(state) {
  state.previousReport = {
    id: previousReportId,
    title: "August performance",
    period_start: "2026-08-01",
    period_end: "2026-08-31",
    current_published_version_id: previousVersionId,
  };
}

async function expectError(response, status, key) {
  assert.equal(response.status, status);
  assert.equal((await response.json()).errorKey, key);
}

for (const role of [null, "client"]) {
  test(`${role ?? "anonymous"} cannot read or export report data`, async () => {
    const { state, request } = scenario({ role });
    await expectError(await request(), 401, "unauthorized");
    assert.ok(state.reads.every((read) => read.table === "profiles"));
    assert.deepEqual(state.renders, []);
  });
}

for (const [label, body, status, key] of [
  ["malformed JSON", "{", 400, "invalidJson"],
  ["invalid version", { reportVersionId: "invalid" }, 422, "validationFailed"],
  ["missing revision", { revision: undefined }, 422, "validationFailed"],
  ["negative revision", { revision: -1 }, 422, "validationFailed"],
  ["fractional revision", { revision: 1.5 }, 422, "validationFailed"],
  ["unsupported locale", { locale: "fr" }, 422, "validationFailed"],
  ["unsupported page size", { pageSize: "A3" }, 422, "validationFailed"],
  ["nonboolean section", { includeDetails: "false" }, 422, "validationFailed"],
  ["injected report data", { metrics: [{ metric_value: 999 }] }, 422, "validationFailed"],
]) {
  test(`rejects ${label} before report reads or rendering`, async () => {
    const { state, request } = scenario();
    await expectError(await request(body), status, key);
    assert.ok(state.reads.every((read) => read.table === "profiles"));
    assert.deepEqual(state.renders, []);
  });
}

test("invalid report ID is rejected before data reads", async () => {
  const { state, request } = scenario();
  await expectError(await request({}, "invalid"), 404, "notFound");
  assert.ok(state.reads.every((read) => read.table === "profiles"));
});

test("the download path produces a real PDF through the route and App Router JSX runtime", async (t) => {
  const [{ default: nextJsxRuntime }, renderer, { readFile }] = await Promise.all([
    import("next/dist/compiled/react/jsx-runtime.js"),
    import("@react-pdf/renderer"),
    import("node:fs/promises"),
  ]);
  const load = appLoader({
    "react/jsx-runtime": nextJsxRuntime,
    "@react-pdf/renderer": renderer,
    "@/locales/portal/en.json": JSON.parse(await readFile(new URL("../src/locales/portal/en.json", import.meta.url), "utf8")),
    "@/locales/portal/ar.json": JSON.parse(await readFile(new URL("../src/locales/portal/ar.json", import.meta.url), "utf8")),
  });
  const { renderReportPdf } = load("src/lib/reports/export/document.tsx");
  const { requestReportPdf } = load("src/lib/reports/export/client.ts");
  const { state, request } = scenario({ renderPdf: renderReportPdf });
  state.version.reports.title = "تقرير سبتمبر";
  state.version.reports.clients.name = "صفحة العميل • Client";
  t.mock.method(globalThis, "fetch", async (_url, options) => request(JSON.parse(options.body)));
  const result = await requestReportPdf({ reportId, reportVersionId: versionId, revision: 7, locale: "ar", pageSize: "A4", includeSummary: true, includePlatforms: true, includeDetails: true }, new AbortController().signal);
  const pdf = Buffer.from(await result.blob.arrayBuffer());
  assert.ok(pdf.byteLength > 10_000);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.match(pdf.subarray(-20).toString(), /%%EOF/);
  assert.match(result.filename, /^تقرير سبتمبر.*\.pdf$/);
});

for (const mismatch of ["report_id", "embedded_report"]) {
  test(`rejects a version with ${mismatch} belonging to another report`, async () => {
    const { state, request } = scenario();
    if (mismatch === "report_id") state.version.report_id = previousReportId;
    else state.version.reports.id = previousReportId;
    await expectError(await request(), 404, "notFound");
    assert.equal(state.reads.filter((read) => read.table === "metrics").length, 0);
    assert.deepEqual(state.renders, []);
  });
}

test("a missing version is not exported", async () => {
  const { state, request } = scenario({ version: null });
  await expectError(await request(), 404, "notFound");
  assert.deepEqual(state.renders, []);
});

test("returns a downloadable PDF with safe headers and complete default options", async () => {
  const { state, request } = scenario();
  const before = Date.now();
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("content-length"), String(pdfBytes.length));
  assert.ok(response.headers.get("x-request-id"));
  assert.match(response.headers.get("content-disposition"), /^attachment; filename="September-performance-2026-09-01-v2.pdf"; filename\*=UTF-8''/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdfBytes);
  assert.equal(state.renders.length, 1);
  assert.deepEqual(state.renders[0].options, { locale: "en", pageSize: "A4", includeSummary: true, includePlatforms: true, includeDetails: true });
  const { data } = state.renders[0];
  assert.deepEqual(data.version.aiSummary, aiSummary);
  assert.equal(data.version.summary, "A saved report introduction.");
  assert.equal(data.report.clientName, "Example client");
  assert.equal(data.report.companyName, "Example company");
  assert.equal(data.version.number, 2);
  assert.equal(data.version.revision, 7);
  assert.equal(data.totalMetrics, 1);
  assert.equal(data.excludedMetrics, 0);
  assert.equal(data.comparison.current.totalViews, 42);
  assert.equal(data.comparison.hasPrevious, false);
  assert.equal(data.previousPeriod, null);
  assert.ok(Date.parse(data.generatedAt) >= before);
  assert.ok(Date.parse(data.generatedAt) <= Date.now());
});

test("passes locale, paper and chosen sections to the renderer", async () => {
  const { state, request } = scenario();
  const options = { locale: "ar", pageSize: "LETTER", includeSummary: false, includePlatforms: false, includeDetails: false };
  assert.equal((await request(options)).status, 200);
  assert.deepEqual(state.renders[0].options, options);
});

test("download filename safely preserves Arabic and cannot inject headers or paths", async () => {
  const { state, request } = scenario();
  state.version.reports.title = 'تقرير سبتمبر / \\ " \r\nX-Injected: yes';
  const response = await request({ locale: "ar" });
  assert.equal(response.status, 200);
  const disposition = response.headers.get("content-disposition");
  assert.match(disposition, /filename\*=UTF-8''%D8%AA%D9%82%D8%B1%D9%8A%D8%B1/);
  assert.ok(!/[\r\n]/.test(disposition));
  assert.ok(!disposition.includes("%2F"));
  assert.ok(!disposition.includes("%5C"));
  assert.equal(response.headers.get("x-injected"), null);
});

for (const status of ["draft", "needs_review", "failed", "approved", "published", "archived"]) {
  test(`exports reviewed metrics while preserving ${status} status`, async () => {
    const { state, request } = scenario();
    state.version.status = status;
    if (status === "published") state.version.reports.current_published_version_id = versionId;
    assert.equal((await request()).status, 200);
    assert.equal(state.renders[0].data.version.status, status);
  });
}

test("an in-progress report cannot export partial processing results", async () => {
  const { state, request } = scenario();
  state.version.status = "processing";
  await expectError(await request(), 409, "batchProcessing");
  assert.deepEqual(state.renders, []);
});

for (const jobStatus of ["queued", "processing"]) test(`an active ${jobStatus} job blocks export even when the version status is draft`, async () => {
  const { state, request } = scenario();
  state.version.status = "draft";
  state.version.insight_batches = [{ status: "uploaded", ai_jobs: [{ status: jobStatus }] }];
  await expectError(await request(), 409, "batchProcessing");
  assert.deepEqual(state.renders, []);
});

test("analysis starting during metric loading cannot produce a partial report", async () => {
  const { state, request } = scenario();
  state.beforeVersionRecheck = (state, current) => {
    if (current) state.version.insight_batches = [{ status: "processing", ai_jobs: [{ status: "processing" }] }];
  };
  await expectError(await request(), 409, "batchProcessing");
  assert.deepEqual(state.renders, []);
});

test("unreviewed, unreadable and nonfinite values never reach the renderer or calculations", async () => {
  const { state, request } = scenario({ metrics: [
    metric(),
    metric({ id: "pending", metric_value: 987654, needs_review: true }),
    metric({ id: "unreadable", metric_value: null }),
    metric({ id: "infinite", metric_value: Infinity }),
    metric({ id: "nan", metric_value: NaN }),
  ] });
  assert.equal((await request()).status, 200);
  const { data } = state.renders[0];
  assert.equal(data.metrics.length, 1);
  assert.equal(data.comparison.current.totalViews, 42);
  assert.equal(data.totalMetrics, 5);
  assert.equal(data.excludedMetrics, 4);
  assert.ok(!JSON.stringify(data).includes("987654"));
});

for (const metrics of [[], [metric({ needs_review: true })], [metric({ metric_value: null })]]) {
  test(`a report with no usable reviewed values cannot export (${metrics.length ? metrics[0].needs_review ? "unreviewed" : "unreadable" : "empty"})`, async () => {
    const { state, request } = scenario({ metrics });
    await expectError(await request(), 422, "noMetrics");
    assert.deepEqual(state.renders, []);
  });
}

test("preserves row dates, units, values and account scope without merging detail rows", async () => {
  const { state, request } = scenario({ metrics: [
    metric(),
    metric({ id: "second-day", metric_date: "2026-09-29", metric_value: 24 }),
    metric({ id: "rate", metric_name: "engagement_rate", metric_unit: "percent", metric_value: 2.5 }),
    metric({ id: "manual", insight_batch_id: null, insight_batches: null, metric_name: "watch_time", metric_unit: "minutes", metric_value: 12.5 }),
  ] });
  assert.equal((await request()).status, 200);
  const { data } = state.renders[0];
  assert.equal(data.metrics.length, 4);
  assert.deepEqual(data.metrics.map((row) => row.metric_date), ["2026-09-30", "2026-09-29", "2026-09-30", "2026-09-30"]);
  assert.equal(data.metrics[0].accountName, "Main page");
  assert.equal(data.metrics[0].accountId, "instagram-account");
  assert.equal(data.metrics[0].accountStage, "Established");
  assert.equal(data.metrics[2].metric_unit, "percent");
  assert.equal(data.metrics[3].metric_unit, "minutes");
  assert.equal(data.metrics[3].metric_value, 12.5);
  assert.equal(data.metrics[3].accountName, null);
  assert.equal(data.comparison.current.engagementRate, 2.5);
});

test("paginates all metrics beyond Supabase's default 1000-row cap", async () => {
  const metrics = Array.from({ length: 1007 }, (_, index) => metric({ id: `metric-${String(index).padStart(4, "0")}`, metric_value: 1 }));
  const { state, request } = scenario({ metrics });
  assert.equal((await request()).status, 200);
  const { data } = state.renders[0];
  assert.equal(data.metrics.length, 1007);
  assert.equal(data.totalMetrics, 1007);
  assert.equal(data.comparison.current.totalViews, 1007);
  assert.deepEqual(state.reads.filter((read) => read.table === "metrics").map((read) => read.range), [[0, 499], [500, 999], [1000, 1499]]);
});

test("paginates correctly when the server row cap is below the requested page size", async () => {
  const metrics = Array.from({ length: 501 }, (_, index) => metric({ id: `metric-${index}`, metric_value: 1 }));
  const { state, request } = scenario({ metrics, serverRowCap: 200 });
  assert.equal((await request()).status, 200);
  assert.equal(state.renders[0].data.metrics.length, 501);
  assert.equal(state.renders[0].data.comparison.current.totalViews, 501);
  assert.deepEqual(state.reads.filter((read) => read.table === "metrics").map((read) => read.range), [[0, 499], [200, 699], [400, 899]]);
});

test("does not label an orphaned published status as a current publication", async () => {
  const { state, request } = scenario();
  state.version.status = "published";
  await expectError(await request(), 409, "staleReport");
  assert.deepEqual(state.renders, []);
});

test("does not compare a previous version no longer targeted by the published pointer", async () => {
  const { state, request } = scenario();
  withPrevious(state);
  state.previousVersion.reports.current_published_version_id = null;
  assert.equal((await request()).status, 200);
  assert.equal(state.renders[0].data.previousPeriod, null);
  assert.equal(state.renders[0].data.comparison.hasPrevious, false);
});

test("rejects previous period metadata changing between the candidate and version reads", async () => {
  const { state, request } = scenario();
  withPrevious(state);
  state.previousVersion.reports.period_end = "2026-09-15";
  await expectError(await request(), 409, "staleReport");
  assert.deepEqual(state.renders, []);
});

test("compares only the same client's preceding nonoverlapping published period", async () => {
  const { state, request } = scenario();
  withPrevious(state);
  assert.equal((await request()).status, 200);
  const { data } = state.renders[0];
  assert.equal(data.comparison.kpiGrowth.totalViews.percent, 100);
  assert.equal(data.comparison.metrics[0].previous, 21, "Stable account identity links different batch IDs");
  assert.equal(data.previousPeriod.title, "August performance");
  assert.equal(data.previousPeriod.versionNumber, 3);
  const previous = state.reads.find((read) => read.table === "reports");
  assert.equal(previous.filters.client_id, clientId);
  assert.ok(previous.conditions.some((condition) => JSON.stringify(condition) === JSON.stringify(["lt", "period_end", "2026-09-01"])));
  assert.ok(previous.conditions.some((condition) => JSON.stringify(condition) === JSON.stringify(["not", "current_published_version_id", "is", null])));
});

test("zero previous baseline produces no fabricated percentage growth", async () => {
  const { state, request } = scenario({ previousMetrics: [metric({ metric_value: 0 })] });
  withPrevious(state);
  assert.equal((await request()).status, 200);
  const growth = state.renders[0].data.comparison.kpiGrowth.totalViews;
  assert.equal(growth.percent, null);
  assert.equal(growth.fromZero, true);
  assert.equal(growth.absolute, 42);
});

for (const reason of ["withdrawn", "wrong_client", "no_reviewed_metrics"]) {
  test(`omits an unusable previous period: ${reason}`, async () => {
    const { state, request } = scenario();
    withPrevious(state);
    if (reason === "withdrawn") state.previousVersion.status = "approved";
    if (reason === "wrong_client") state.previousVersion.reports.client_id = actorId;
    if (reason === "no_reviewed_metrics") state.previousMetrics[0].needs_review = true;
    assert.equal((await request()).status, 200);
    assert.equal(state.renders[0].data.comparison.hasPrevious, false);
    assert.equal(state.renders[0].data.previousPeriod, null);
  });
}

test("stale editor revision is rejected before loading metrics", async () => {
  const { state, request } = scenario();
  await expectError(await request({ revision: 6 }), 409, "staleReport");
  assert.equal(state.reads.filter((read) => read.table === "metrics").length, 0);
  assert.deepEqual(state.renders, []);
});

for (const change of ["metrics", "publication", "report_metadata", "deletion"]) {
  test(`rejects a concurrent ${change} change during data loading`, async () => {
    const { state, request } = scenario({
      beforeVersionRecheck(current, isCurrent) {
        if (!isCurrent) return;
        if (change === "metrics") current.version.revision += 1;
        if (change === "publication") current.version.status = "published";
        if (change === "report_metadata") current.version.reports.title = "Changed while exporting";
        if (change === "deletion") current.version = null;
      },
    });
    await expectError(await request(), 409, "staleReport");
    assert.deepEqual(state.renders, []);
  });
}

test("rejects a previous publication changing during export", async () => {
  const { state, request } = scenario({
    beforeVersionRecheck(current, isCurrent) {
      if (!isCurrent) current.previousVersion.status = "archived";
    },
  });
  withPrevious(state);
  await expectError(await request(), 409, "staleReport");
  assert.deepEqual(state.renders, []);
});

for (const errorKey of ["readError", "metricsError", "previousReportError", "previousMetricsError", "renderError"]) {
  test(`${errorKey} produces a safe error without a partial PDF`, async () => {
    const error = errorKey === "renderError" ? new Error("private renderer path") : { code: "42501", message: "Private database path" };
    const { state, request } = scenario({ [errorKey]: error });
    withPrevious(state);
    const response = await request();
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { errorKey: "serverError" });
    assert.equal(response.headers.get("cache-control"), "no-store");
    if (errorKey !== "renderError") assert.deepEqual(state.renders, []);
  });
}
