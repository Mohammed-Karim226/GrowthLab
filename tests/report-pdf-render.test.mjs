import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import * as renderer from "@react-pdf/renderer";
import { cloneElement } from "react";
import nextJsxRuntime from "next/dist/compiled/react/jsx-runtime.js";
import { appLoader } from "./helpers/app-loader.mjs";

const layouts = [];
const catalogs = Object.fromEntries(await Promise.all(["en", "ar"].map(async locale => [
  locale,
  JSON.parse(await readFile(new URL(`../src/locales/portal/${locale}.json`, import.meta.url), "utf8")),
])));
if (process.env.REPORT_PDF_SAMPLE_DIR) await mkdir(process.env.REPORT_PDF_SAMPLE_DIR, { recursive: true });
const load = appLoader({
  // Exercise the App Router's React 19 JSX against the external React 18 PDF
  // renderer. Plain Node tests used to miss the actual download failure.
  "react/jsx-runtime": nextJsxRuntime,
  "@react-pdf/renderer": { ...renderer, renderToBuffer: async (element) => {
    const doc = element.type(element.props);
    return renderer.renderToBuffer(cloneElement(doc, { onRender: ({ _INTERNAL__LAYOUT__DATA_: layout }) => {
      layouts.push(layout);
    } }));
  } },
  "@/locales/portal/en.json": catalogs.en,
  "@/locales/portal/ar.json": catalogs.ar,
});
const { renderReportPdf } = load("src/lib/reports/export/document.tsx");
const { comparePeriods } = load("src/lib/analytics/comparisons.ts");

function textNodes(node) {
  return [node, ...(node.children ?? []).flatMap(textNodes)].filter((child) => child.type === "TEXT");
}

function pageText(page) {
  // Arabic layout runs use visual order. Keep the logical text of nodes that
  // actually rendered lines when checking translated headings.
  return textNodes(page).filter(node => node.lines?.length).flatMap(node => [
    ...(node.children ?? []).filter(child => child.type === "TEXT_INSTANCE").map(child => child.value),
    ...node.lines.map(line => line.string),
  ]).join(" ");
}

function assertLayout(layout) {
  for (const [index, page] of layout.children.entries()) {
    const footer = page.children.find((child) => child.style?.position === "absolute" && child.style?.bottom === 23);
    assert.ok(footer, `Page ${index + 1} needs a footer`);
    assert.ok(footer.box.top + footer.box.height < page.box.height, "Footer must stay inside the page");
    const footerText = textNodes(footer);
    assert.ok(footerText.length >= 2);
    for (const node of footerText) assert.ok(node.lines?.length, "Footer and folio text must actually render");
    assert.ok(footerText.some(node => node.lines.some(line => /[0-9٠-٩]/u.test(line.string))), "Every page needs its page number");
    const content = page.children.filter(child => child.style?.position !== "absolute" && !child.props?.fixed);
    assert.ok(content.some(child => textNodes(child).some(node => node.lines?.some(line => line.string.trim()))), "Every page must contain report content");
    for (const child of content) {
      assert.ok(child.box.top >= page.box.paddingTop - 0.5, `Page ${index + 1} content must clear its header`);
      assert.ok(child.box.top + child.box.height <= footer.box.top - 5, `Page ${index + 1} content must clear its footer`);
    }
    for (const node of textNodes(page)) {
      if (node.style?.lineHeight) assert.ok(node.style.lineHeight < 100, "Pagination must not multiply resolved line heights");
    }
    assert.ok(!textNodes(page).flatMap(node => node.lines?.map(line => line.string) ?? []).join(" ").includes("INTERNAL NOTE"), "Internal notes must never enter the PDF");
    const detailHeader = page.children.find(child => child.props?.fixed && child.style?.top === 70);
    if (detailHeader) {
      assert.ok(detailHeader.box.top + detailHeader.box.height <= page.box.paddingTop, `Repeated column headings (${detailHeader.box.top + detailHeader.box.height}) must clear detail rows (${page.box.paddingTop})`);
    }
  }
}

function sample(locale, count = 32) {
  const platforms = ["facebook", "instagram", "tiktok", "youtube"];
  const names = ["views", "reach", "engagement", "followers", "follower_growth", "engagement_rate", "watch_time", "profile_visits"];
  const metrics = Array.from({ length: count }, (_, index) => ({
    id: `metric-${index}`, report_version_id: "version-2", insight_batch_id: `batch-${index % 4}`,
    platform: platforms[index % 4], metric_name: names[Math.floor(index / 4) % 8],
    metric_value: Math.floor(index / 4) === 5 ? 3.45 : index === 28 ? 0 : (index + 1) * 1452,
    metric_unit: Math.floor(index / 4) === 5 ? "percent" : Math.floor(index / 4) === 6 ? "seconds" : "count",
    metric_date: "2026-09-30", needs_review: false, source: "manual", confidence: null,
    note: "INTERNAL NOTE: never include this in the client document", accountId: `account-${index % 4}`,
    accountName: locale === "ar" ? "بودكاست مايند • Mind Podcast" : "Mind Podcast", accountStage: null,
  }));
  return {
    report: { id: "report-1", title: locale === "ar" ? "تقرير الأداء الشهري لمنصات التواصل الاجتماعي" : "September performance report", clientName: locale === "ar" ? "بودكاست مايند" : "Mind Podcast", companyName: "Mind Media", periodStart: "2026-09-01", periodEnd: "2026-09-30" },
    version: { id: "version-2", number: 2, revision: 7, status: "published", publishedAt: "2026-10-01T12:00:00Z", summary: null, aiSummary: {
      summary: locale === "ar" ? "حقق المحتوى أداءً قوياً خلال شهر سبتمبر، مع تحسن واضح في الوصول والتفاعل عبر المنصات. تركز المرحلة القادمة على تحويل هذا الاهتمام إلى جمهور مستمر، مع اختبار أفكار جديدة ومراجعة النتائج بانتظام." : "September delivered a stronger audience response across the portfolio. The clearest opportunity is to turn that attention into a returning audience through consistent publishing and focused creative experiments.",
      went_well: [locale === "ar" ? "حقق المحتوى القصير تفاعلاً مرتفعاً عبر المنصات." : "Short-form content generated strong engagement across the active platforms."],
      what_changed: [locale === "ar" ? "اتسع نطاق الوصول مقارنة بالفترة المنشورة السابقة." : "Distribution expanded compared with the previous published period."],
      needs_attention: [locale === "ar" ? "تحتاج زيارات الملف الشخصي إلى متابعة منتظمة." : "Profile visits should be monitored alongside audience growth."],
      recommendations: [locale === "ar" ? "اختبر مقدمتين مختلفتين للمحتوى القادم ثم قارن النتائج." : "Test two opening hooks in the next content cycle and compare results.", locale === "ar" ? "حافظ على جدول نشر ثابت وراجع النتائج أسبوعياً." : "Maintain a consistent publishing schedule and review performance weekly."],
      generated_at: "2026-10-01T12:00:00Z",
    } },
    metrics, comparison: comparePeriods(metrics, metrics.map((metric) => ({ ...metric, metric_value: metric.metric_value / 1.25 }))),
    previousPeriod: { title: "August performance", periodStart: "2026-08-01", periodEnd: "2026-08-31", versionNumber: 1 },
    excludedMetrics: 2, totalMetrics: count + 2, generatedAt: "2026-10-15T12:00:00Z",
  };
}

function pageCount(buffer) {
  return [...buffer.toString("latin1").matchAll(/\/Type \/Page\b/g)].length;
}

for (const locale of ["en", "ar"]) {
  test(`real PDF renderer embeds ${locale} fonts and paginates A4 / Letter reports`, async () => {
    const data = sample(locale);
    const full = await renderReportPdf(data, { locale, pageSize: "A4", includeSummary: true, includePlatforms: true, includeDetails: true });
    if (process.env.REPORT_PDF_SAMPLE_DIR) await writeFile(path.join(process.env.REPORT_PDF_SAMPLE_DIR, `growthlab-${locale}.pdf`), full);
    assertLayout(layouts.at(-1));
    const firstPage = pageText(layouts.at(-1).children[0]);
    const copy = catalogs[locale].reportPdf;
    for (const label of [copy.views, copy.reach, copy.engagement, copy.audience, copy.audienceGrowth, copy.rate, copy.methodology]) {
      assert.ok(label.split(/\s/u).every(word => firstPage.includes(word)), `The overview must keep ${label} on its first page`);
    }
    assert.equal(full.subarray(0, 5).toString(), "%PDF-");
    assert.match(full.toString("latin1"), /\/FontFile2\b/, "Embed fonts for offline sharing");
    assert.ok(pageCount(full) >= 3);
    assert.ok(pageCount(full) <= 4, `A standard report must not scatter 32 metrics and a short review across ${pageCount(full)} pages`);
    assert.ok(full.byteLength > 10_000);
    const compactData = { ...data, version: { ...data.version, status: "draft" }, comparison: comparePeriods(data.metrics, null), previousPeriod: null };
    const compact = await renderReportPdf(compactData, { locale, pageSize: "LETTER", includeSummary: false, includePlatforms: false, includeDetails: false });
    assertLayout(layouts.at(-1));
    assert.equal(pageCount(compact), 1, "The standard overview, all six KPIs, draft notice, and calculation notes must fit on one Letter page");
    assert.ok(pageCount(compact) < pageCount(full), "Section options must remove pages");
    assert.match(compact.toString("latin1"), /\/MediaBox \[0 0 612 792\]/);
    if (process.env.REPORT_PDF_SAMPLE_DIR) {
      await writeFile(path.join(process.env.REPORT_PDF_SAMPLE_DIR, `growthlab-${locale}-compact.pdf`), compact);
    }
  });
}

for (const scenario of ["narrative", "ledger"]) test(`long ${scenario} renders without truncating the document`, async () => {
  const data = sample("ar", scenario === "ledger" ? 150 : 32);
  if (scenario === "narrative") data.version.aiSummary.summary = data.version.aiSummary.summary.repeat(10) + " NarrativeEnd";
  data.version.aiSummary.recommendations = Array.from({ length: 6 }, () => data.version.aiSummary.recommendations[0].repeat(4));
  const pdf = await renderReportPdf(data, { locale: "ar", pageSize: "LETTER", includeSummary: true, includePlatforms: true, includeDetails: true });
  assertLayout(layouts.at(-1));
  if (scenario === "narrative") assert.ok(textNodes(layouts.at(-1)).some(node => node.lines?.some(line => line.string.includes("NarrativeEnd"))), "The final sentence of a long summary must survive pagination");
  assert.ok(pageCount(pdf) >= 5);
  assert.match(pdf.subarray(-20).toString(), /%%EOF/);
  if (process.env.REPORT_PDF_SAMPLE_DIR) await writeFile(path.join(process.env.REPORT_PDF_SAMPLE_DIR, `growthlab-ar-long-${scenario}.pdf`), pdf);
});

for (const locale of ["en", "ar"]) test(`a sparse ${locale} report does not create an empty executive-review page`, async () => {
  const data = sample(locale, 1);
  data.version.summary = " \n ";
  data.version.aiSummary = null;
  const pdf = await renderReportPdf(data, { locale, pageSize: "A4", includeSummary: true, includePlatforms: false, includeDetails: false });
  assertLayout(layouts.at(-1));
  assert.equal(pageCount(pdf), 1, "An unsaved narrative must not generate a placeholder page");
  assert.ok(!pageText(layouts.at(-1).children[0]).includes(catalogs[locale].reportPdf.noSummary));
});

for (const locale of ["en", "ar"]) test(`very long ${locale} review items flow without empty continuation pages`, async () => {
  const data = sample(locale, 1);
  const sentence = locale === "ar" ? "راجع نتائج المحتوى وحسّن خطة النشر بناءً على الأداء. " : "Review content results and refine the publishing plan based on performance. ";
  data.version.aiSummary.summary = sentence.repeat(45) + " SummaryFinalSentence";
  data.version.aiSummary.recommendations = [sentence.repeat(55) + " RecommendationFinalSentence"];
  const pdf = await renderReportPdf(data, { locale, pageSize: "LETTER", includeSummary: true, includePlatforms: true, includeDetails: true });
  const layout = layouts.at(-1);
  assertLayout(layout);
  const strings = textNodes(layout).flatMap(node => node.lines?.map(line => line.string) ?? []);
  for (const marker of ["SummaryFinalSentence", "RecommendationFinalSentence"]) {
    assert.ok(strings.some(value => value.includes(marker)), `${marker} must survive pagination`);
  }
  assert.match(pdf.subarray(-20).toString(), /%%EOF/);
  if (process.env.REPORT_PDF_SAMPLE_DIR) await writeFile(path.join(process.env.REPORT_PDF_SAMPLE_DIR, `growthlab-${locale}-extreme-review.pdf`), pdf);
});

test("Arabic and Latin text retains its glyphs and every detail row survives pagination", async () => {
  const data = sample("ar", 150);
  data.metrics.forEach((metric, index) => { metric.accountName = `صفحة العميل Account-${index}`; });
  const pdf = await renderReportPdf(data, { locale: "ar", pageSize: "A4", includeSummary: true, includePlatforms: true, includeDetails: true });
  const layout = layouts.at(-1);
  assertLayout(layout);
  const nodes = textNodes(layout);
  const strings = nodes.flatMap(node => node.lines?.map(line => line.string) ?? []);
  for (let index = 0; index < 150; index++) assert.ok(strings.some(value => value.includes(`Account-${index}`)), `Detail row ${index} must render`);
  const arabic = nodes.flatMap(node => node.lines ?? []).filter(line => /[\u0600-\u06ff]/u.test(line.string));
  assert.ok(arabic.length);
  for (const line of arabic) for (const run of line.runs ?? []) {
    assert.ok((run.glyphs ?? []).every(glyph => glyph.id !== 0), "Mixed-script text must not render a missing glyph");
  }
  for (const page of layout.children.filter(page => page.children.some(child => child.props?.fixed && child.style?.top === 70))) {
    assert.ok(pageText(page).includes(catalogs.ar.reportPdf.metric), "Every detail page must repeat its metric heading");
    assert.ok(pageText(page).includes("Account-"), "Continued metrics must retain their account context");
  }
  assert.match(pdf.subarray(-20).toString(), /%%EOF/);
});

for (const locale of ["en", "ar"]) test(`long ${locale} report metadata and large values stay within Letter page boundaries`, async () => {
  const data = sample(locale, 32);
  data.report.title = `${data.report.title} / ${data.report.title} / ${data.report.title}`;
  data.report.clientName = `${data.report.clientName} — GrowthLab International Media and Production`;
  data.metrics.forEach((metric, index) => {
    metric.accountName = `${metric.accountName} / Regional content and audience development team`;
    metric.metric_value = index === 0 ? 0 : 9_876_543_210_123.45;
  });
  data.comparison = comparePeriods(data.metrics, null);
  data.previousPeriod = null;
  const pdf = await renderReportPdf(data, { locale, pageSize: "LETTER", includeSummary: true, includePlatforms: true, includeDetails: true });
  assertLayout(layouts.at(-1));
  assert.ok(pageText(layouts.at(-1)).includes("9,876,543,210,123.45"), "Large values must retain their full precision");
  assert.match(pdf.subarray(-20).toString(), /%%EOF/);
});
