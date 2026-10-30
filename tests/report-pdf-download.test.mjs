import assert from "node:assert/strict";
import { test } from "node:test";
import { appLoader } from "./helpers/app-loader.mjs";

const { requestReportPdf, reportPdfFilename, saveReportPdf, ReportPdfDownloadError } = appLoader()("src/lib/reports/export/client.ts");
const input = { reportId: "r", reportVersionId: "v", revision: 7, locale: "ar", pageSize: "A4", includeSummary: true, includePlatforms: true, includeDetails: true };

test("download sends saved version and options with cookies and preserves the Arabic filename", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "/api/admin/reports/r/export");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.cache, "no-store");
    const { reportId, ...body } = input;
    assert.deepEqual(JSON.parse(options.body), body);
    return new Response("%PDF-1.7\n%%EOF", { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent("تقرير.pdf")}` } });
  });
  const result = await requestReportPdf(input, new AbortController().signal);
  assert.equal(result.filename, "تقرير.pdf");
  assert.equal(await result.blob.text(), "%PDF-1.7\n%%EOF");
});

for (const [body, contentType] of [["", "application/pdf"], ["<html>Error</html>", "application/pdf"], ["%PDF-1.7", "text/html"]]) test("invalid or empty responses cannot become a downloaded PDF", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(body, { headers: { "content-type": contentType } }));
  await assert.rejects(requestReportPdf(input, new AbortController().signal), error => error instanceof ReportPdfDownloadError && error.errorKey === "invalidPdf");
});

test("stale revision errors retain their status so the dialog refreshes the report", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ errorKey: "staleReport" }, { status: 409 }));
  await assert.rejects(requestReportPdf(input, new AbortController().signal), error => error.status === 409 && error.errorKey === "staleReport");
});

test("expired login and proxy timeout responses stay actionable even without JSON", async (t) => {
  for (const [status, errorKey] of [[401, "unauthorized"], [504, "timeout"]]) {
    t.mock.method(globalThis, "fetch", async () => new Response("Error", { status }));
    await assert.rejects(requestReportPdf(input, new AbortController().signal), error => error.status === status && error.errorKey === errorKey);
  }
});

test("network failures are distinguished from rejected exports", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(requestReportPdf(input, new AbortController().signal), error => error.errorKey === "networkError");
});

test("a cancelled download preserves its abort rather than displaying an error", async (t) => {
  const controller = new AbortController();
  controller.abort();
  t.mock.method(globalThis, "fetch", async (_, options) => { options.signal.throwIfAborted(); });
  await assert.rejects(requestReportPdf(input, controller.signal), error => error.name === "AbortError");
});

test("the export deadline aborts the connection and clears its timer", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(globalThis, "fetch", async (_, options) => new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true })));
  const result = requestReportPdf(input, new AbortController().signal);
  const rejection = assert.rejects(result, error => error.errorKey === "timeout");
  t.mock.timers.tick(75_000);
  await rejection;
});

test("download URLs stay available until browsers have consumed them", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const events = [];
  const anchor = { style: {}, click: () => events.push("click"), remove: () => events.push("remove") };
  t.mock.method(URL, "createObjectURL", () => "blob:report");
  t.mock.method(URL, "revokeObjectURL", value => events.push(value));
  const original = globalThis.document;
  globalThis.document = { createElement: () => anchor, body: { appendChild: () => events.push("append") } };
  try {
    saveReportPdf(new Blob(["%PDF-"]), "تقرير.pdf");
    assert.equal(anchor.href, "blob:report");
    assert.equal(anchor.download, "تقرير.pdf");
    assert.deepEqual(events, ["append", "click", "remove"]);
    t.mock.timers.tick(60_000);
    assert.deepEqual(events, ["append", "click", "remove", "blob:report"]);
  } finally {
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  }
});

test("unsafe download names cannot create paths or executable extensions", () => {
  assert.equal(reportPdfFilename("attachment; filename=report.pdf"), "report.pdf");
  assert.equal(reportPdfFilename('attachment; filename="../../report.pdf"'), "-..-report.pdf");
  assert.equal(reportPdfFilename('attachment; filename="report.exe"'), "growthlab-report.pdf");
  assert.equal(reportPdfFilename("attachment; filename*=UTF-8''%broken"), "growthlab-report.pdf");
});
