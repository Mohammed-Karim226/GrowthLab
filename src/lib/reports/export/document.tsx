/** @jsxRuntime classic */
/** @jsx React.createElement */
/// <reference lib="es2021.intl" />
import "server-only";

import { createRequire } from "node:module";
import path from "node:path";
import type { ReactNode } from "react";
import { Document, Font, Page, Path, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { calculateGrowth, type GrowthResult } from "@/lib/analytics/calculations";
import { formatDate, formatDateRange, formatNumber, humanizeMetricName } from "@/lib/format";
import en from "@/locales/portal/en.json";
import ar from "@/locales/portal/ar.json";
import type { ReportPdfData, ReportPdfMetric, ReportPdfOptions } from "./contract";

// The external PDF reconciler must use its own React instance. Local classic
// JSX avoids the App Router's bundled React without extra runtime modules.
const rendererRequire = createRequire(path.join(process.cwd(), "node_modules/@react-pdf/renderer/package.json"));
const React = rendererRequire("react") as typeof import("react");

// Fonts are installed and traced with the server bundle. Exports never depend
// on a remote font service, and both scripts remain selectable in the PDF.
for (const subset of ["latin", "latin-ext", "arabic"]) {
  Font.register({
    family: `Cairo-${subset}`,
    fonts: [400, 700].map((weight) => ({
      src: path.join(process.cwd(), "node_modules/@fontsource/cairo/files", `cairo-${subset}-${weight}-normal.woff`),
      fontWeight: weight,
    })),
  });
}
Font.registerHyphenationCallback((word) => [word]);

let fontsReady: Promise<void> | undefined;
function prepareFonts() {
  // Fontsource's script subsets share a PostScript name. PDFKit caches by
  // that name, so each subset needs a distinct identity or mixed Arabic and
  // Latin text can be drawn with another subset's glyphs.
  fontsReady ??= Promise.all(["latin", "latin-ext", "arabic"].flatMap((subset) => [400, 700].map(async (fontWeight) => {
    const font = Font.getFont({ fontFamily: `Cairo-${subset}`, fontWeight });
    await font.load();
    if (!font.data) throw new Error("Report font could not be loaded");
    Object.defineProperty(font.data, "postscriptName", { value: `GrowthLab-Cairo-${subset}-${fontWeight}`, configurable: true });
  }))).then(() => undefined).catch((error: unknown) => {
    fontsReady = undefined;
    throw error;
  });
  return fontsReady;
}

const ink = "#111827";
const gold = "#b18b40";
const muted = "#64748b";
const line = "#e2e8f0";
const colors = { facebook: "#4267b2", instagram: "#9854a0", tiktok: "#187b7b", youtube: "#c34f4a" };
const inset = 38;
const detailWidths = ["39%", "23%", "24%", "14%"];

// Use the fonts' natural line metrics. Numeric lineHeight values are resolved
// again by React-PDF during pagination and can inflate continued pages.
const s = StyleSheet.create({
  page: { paddingTop: 78, paddingBottom: 58, paddingHorizontal: inset, backgroundColor: "#ffffff", color: ink, fontFamily: ["Cairo-latin", "Cairo-latin-ext", "Cairo-arabic"], fontSize: 9 },
  header: { position: "absolute", top: 25, left: inset, right: inset, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: line },
  brand: { flexDirection: "row", gap: 7, alignItems: "center", direction: "ltr" },
  brandName: { fontSize: 15, fontWeight: 700, letterSpacing: -0.4 },
  eyebrow: { fontSize: 6.5, color: muted },
  headerSection: { fontSize: 8, fontWeight: 700 },
  footer: { position: "absolute", left: inset, right: inset, bottom: 23, borderTopWidth: 1, borderTopColor: line, paddingTop: 6, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: muted },
  hero: { backgroundColor: "#0b1020", borderRadius: 8, padding: 18, marginBottom: 18 },
  heroTitle: { color: "#ffffff", fontSize: 21, fontWeight: 700, marginTop: 5, marginBottom: 10 },
  heroMeta: { flexDirection: "row", gap: 18, borderTopWidth: 1, borderTopColor: "#343747", paddingTop: 10 },
  heroLabel: { color: "#e0c98f", fontSize: 7 },
  heroValue: { color: "#f4f1e8", fontSize: 9, marginTop: 2 },
  heading: { fontSize: 17, fontWeight: 700, marginBottom: 2 },
  intro: { fontSize: 8, color: muted, marginBottom: 8 },
  sectionTitle: { marginBottom: 8, borderBottomWidth: 1, borderBottomColor: line },
  grid: { flexDirection: "row", gap: 8, marginTop: 10 },
  kpi: { flex: 1, minWidth: 0, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: line, borderTopWidth: 2, borderTopColor: gold, borderRadius: 6, padding: 9 },
  kpiLabel: { fontSize: 8, color: muted, minHeight: 22 },
  kpiValue: { fontSize: 20, fontWeight: 700, marginTop: 1, direction: "ltr" },
  growth: { fontSize: 7, marginTop: 2, direction: "ltr" },
  note: { color: muted, fontSize: 7.5, marginTop: 9 },
  callout: { backgroundColor: "#faf6ed", borderWidth: 1, borderColor: "#e8dcc0", padding: 10, borderRadius: 6, marginTop: 10, fontSize: 8 },
  contents: { marginTop: 12, borderTopWidth: 1, borderTopColor: line, paddingTop: 8, fontSize: 7.5, color: muted },
  prose: { fontSize: 9, marginBottom: 7 },
  summaryLead: { marginTop: 2, marginBottom: 4 },
  subheading: { fontSize: 10, fontWeight: 700, marginTop: 10, marginBottom: 4 },
  summaryHeading: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 8, marginBottom: 3, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: line },
  marker: { width: 4, height: 14, borderRadius: 2 },
  listItem: { flexDirection: "row", gap: 9, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  listNumber: { width: 19, fontSize: 8, color: gold, fontWeight: 700 },
  listText: { flex: 1, minWidth: 0, fontSize: 9 },
  tableHead: { backgroundColor: "#f1f5f9", color: "#334155", paddingVertical: 5, paddingHorizontal: 8, flexDirection: "row", fontSize: 7.5, fontWeight: 700, borderBottomWidth: 1, borderBottomColor: "#cbd5e1" },
  tableRow: { flexDirection: "row", flexShrink: 0, paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: line, fontSize: 8.5 },
  cell: { paddingHorizontal: 4, minWidth: 0 },
  numeric: { direction: "ltr", textAlign: "right" },
  barTrack: { height: 3, backgroundColor: "#e2e8f0", borderRadius: 2, marginTop: 3 },
  bar: { height: 3, borderRadius: 2 },
  detailHeader: { position: "absolute", top: 70, left: inset, right: inset },
  groupHeading: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: "#f8fafc", borderBottomWidth: 1, borderBottomColor: line },
  methodology: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: line },
});

function Brand() {
  return <View style={s.brand}>
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M3 18V9M9 18V5M15 18V12M21 18V2" stroke={gold} strokeWidth={3} strokeLinecap="round" />
    </Svg>
    <Text style={s.brandName}>GrowthLab</Text>
  </View>;
}

function pdfContext(data: ReportPdfData, options: ReportPdfOptions) {
  const { report, version, comparison } = data;
  const { locale } = options;
  const dictionary = locale === "ar" ? ar : en;
  const copy = dictionary.reportPdf;
  const rtl = locale === "ar";
  const direction = { direction: rtl ? "rtl" as const : "ltr" as const, textAlign: rtl ? "right" as const : "left" as const };
  const row = { flexDirection: rtl ? "row-reverse" as const : "row" as const };
  const status = dictionary.status[version.status];
  const draft = version.status !== "published" && version.status !== "archived";
  const number = (value: number | null) => formatNumber(value, locale, { maximumFractionDigits: 2 });
  const date = (value: string | null) => formatDate(value, locale);
  const dateRange = (start: string, end: string) => new Intl.DateTimeFormat(locale, {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  }).formatRange(new Date(start), new Date(end));
  const period = dateRange(report.periodStart, report.periodEnd);
  const previous = data.previousPeriod ? dateRange(data.previousPeriod.periodStart, data.previousPeriod.periodEnd) : null;
  const metricLabel = (name: string) => dictionary.metrics[name as keyof typeof dictionary.metrics] ?? humanizeMetricName(name);
  const unitLabel = (unit: string) => copy.units[unit as keyof typeof copy.units] ?? unit;
  return { data, options, report, version, comparison, locale, copy, dictionary, rtl, direction, row, status, draft, number, date, period, previous, metricLabel, unitLabel };
}

type PdfContext = ReturnType<typeof pdfContext>;

function Shell({ context, children, title, detail = false }: { context: PdfContext; children: ReactNode; title: string; detail?: boolean }) {
  const { options, copy, direction, row, draft, version, number, rtl } = context;
  return <Page size={options.pageSize} bookmark={title} style={[s.page, direction, detail ? { paddingTop: 145 } : {}]}>
    <View style={s.header} fixed>
      <Brand />
      <View style={{ maxWidth: "48%" }}>
        <Text style={[s.eyebrow, direction]}>{copy.intelligence}</Text>
        <Text style={[s.headerSection, direction]}>{title}</Text>
      </View>
    </View>
    {detail && <View fixed style={s.detailHeader}>
      <Text style={[s.heading, { fontSize: 14 }]}>{title}</Text>
      <Text style={[s.intro, { fontSize: 7, marginBottom: 5 }]}>{copy.detailsHint}</Text>
      <View style={[s.tableHead, row]}>
        {[copy.metric, copy.date, copy.value, copy.unit].map((label, index) => <Text key={label} style={[s.cell, { width: detailWidths[index], textAlign: index === 2 ? "right" : direction.textAlign }]}>{label}</Text>)}
      </View>
    </View>}
    <View style={[s.footer, row]} fixed>
      <Text style={{ width: "65%" }}>{`GrowthLab  /  ${draft ? `${copy.draft} · ` : version.status === "archived" ? `${context.status} · ` : ""}${copy.version} ${number(version.number)}`}</Text>
      <Text style={{ width: "35%", textAlign: rtl ? "left" : "right" }} render={({ pageNumber, totalPages }) => `${copy.page} ${number(pageNumber)} ${copy.of} ${number(totalPages)}`} />
    </View>
    {children}
  </Page>;
}

function SectionTitle({ title, hint, keepAhead = 50 }: { title: string; hint: string; keepAhead?: number }) {
  return <View style={s.sectionTitle} wrap={false} minPresenceAhead={keepAhead}>
    <Text style={s.heading} id={title}>{title}</Text><Text style={s.intro}>{hint}</Text>
  </View>;
}

function Methodology({ context }: { context: PdfContext }) {
  const { copy, previous, data, locale, number } = context;
  const hasNarrative = context.options.includeSummary && Boolean(data.version.summary?.trim() || data.version.aiSummary);
  return <View style={s.methodology} wrap={false}>
    <Text style={[s.subheading, { fontSize: 9, marginTop: 0 }]}>{copy.methodology}</Text>
    <Text style={{ fontSize: 7, color: muted }}>{copy.method}{previous ? ` ${copy.comparisonNote}` : ""}{hasNarrative ? ` ${copy.savedLanguage}` : ""}</Text>
    <Text style={{ fontSize: 7, color: muted, marginTop: 6 }}>{`${copy.generated} ${formatDate(data.generatedAt, locale)} · ${number(data.metrics.length)} ${copy.reviewed}`}</Text>
  </View>;
}

function Growth({ context, growth, align }: { context: PdfContext; growth?: GrowthResult; align?: "left" | "right" }) {
  const { copy, number, direction } = context;
  if (!growth || growth.direction === "unknown") return null;
  const label = growth.fromZero ? (growth.direction === "flat" ? copy.flat : copy.fromZero)
    : `${(growth.percent ?? 0) > 0 ? "+" : ""}${number(growth.percent)}%`;
  return <Text style={[s.growth, growth.fromZero ? direction : {}, { textAlign: align ?? direction.textAlign, color: growth.direction === "down" ? "#a44c45" : growth.direction === "up" ? "#27745c" : muted }]}>{label}</Text>;
}

function paragraphs(value: string) {
  return value.trim().split(/\n\s*\n/u).filter(Boolean);
}

function metricGroups(data: ReportPdfData, locale: ReportPdfOptions["locale"]) {
  const groups = new Map<string, { platform: ReportPdfMetric["platform"]; accountName: string | null; metrics: ReportPdfMetric[] }>();
  const platformOrder = Object.keys(colors);
  const sorted = [...data.metrics].sort((a, b) => platformOrder.indexOf(a.platform) - platformOrder.indexOf(b.platform)
    || (a.accountName ?? "").localeCompare(b.accountName ?? "", locale)
    || (a.accountId ?? a.insight_batch_id ?? "").localeCompare(b.accountId ?? b.insight_batch_id ?? "")
    || (a.metric_date ?? "").localeCompare(b.metric_date ?? "")
    || a.metric_name.localeCompare(b.metric_name)
    || a.id.localeCompare(b.id));
  for (const metric of sorted) {
    const key = JSON.stringify([metric.platform, metric.accountId ?? metric.insight_batch_id ?? metric.accountName]);
    const group = groups.get(key) ?? { platform: metric.platform, accountName: metric.accountName, metrics: [] };
    group.metrics.push(metric);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function DetailRow({ context, metric, index }: { context: PdfContext; metric: ReportPdfMetric; index: number }) {
  const { row, direction, number, date, metricLabel, unitLabel } = context;
  return <View style={[s.tableRow, row, { backgroundColor: index % 2 ? "#f8fafc" : "#ffffff", paddingVertical: 2.5 }]} wrap={false}>
    <View style={[s.cell, { width: detailWidths[0] }]}>
      <Text style={{ fontWeight: 700 }}>{metricLabel(metric.metric_name)}</Text>
      <Text style={{ fontSize: 7, color: muted }}>{`${context.dictionary.platforms[metric.platform]} / ${metric.accountName || context.copy.unassigned}`}</Text>
    </View>
    <Text style={[s.cell, { width: detailWidths[1], fontSize: 7.5 }]}>{date(metric.metric_date)}</Text>
    <Text style={[s.cell, s.numeric, { width: detailWidths[2], fontWeight: 700, fontSize: number(metric.metric_value).length > 17 ? 6.5 : 8 }]}>{number(metric.metric_value)}</Text>
    <Text style={[s.cell, direction, { width: detailWidths[3], fontSize: 7.5 }]}>{unitLabel(metric.metric_unit)}</Text>
  </View>;
}

function DetailGroup({ context, group }: { context: PdfContext; group: ReturnType<typeof metricGroups>[number] }) {
  const { copy, dictionary, number, row, rtl } = context;
  // Keep the account heading with its first row. Every row retains its account
  // context when it flows beneath the repeated column headings on another page.
  return <View>
    <View wrap={false}>
      <View style={[s.groupHeading, row, rtl ? { borderRightWidth: 3, borderRightColor: colors[group.platform] } : { borderLeftWidth: 3, borderLeftColor: colors[group.platform] }]}>
        <Text style={{ flex: 1, fontSize: 9, fontWeight: 700 }}>
          {dictionary.platforms[group.platform]}
          <Text style={{ fontSize: 8, fontWeight: 400 }}>{` / ${group.accountName || copy.unassigned}`}</Text>
        </Text>
        <Text style={{ fontSize: 7, color: muted, marginHorizontal: 6 }}>{`${number(group.metrics.length)} ${copy.metricsCount}`}</Text>
      </View>
      <DetailRow context={context} metric={group.metrics[0]} index={0} />
    </View>
    {group.metrics.slice(1).map((metric, index) => <DetailRow key={metric.id} context={context} metric={metric} index={index + 1} />)}
  </View>;
}

/** A vector document with flowing text, embedded fonts, bookmarks and folios. */
export function ReportPdfDocument({ data, options }: { data: ReportPdfData; options: ReportPdfOptions }) {
  const context = pdfContext(data, options);
  const { report, version, comparison, locale, copy, dictionary, direction, row, status, draft, number, period, previous } = context;
  const kpis = [
    { label: copy.views, value: comparison.current.totalViews, growth: comparison.kpiGrowth.totalViews },
    { label: copy.reach, value: comparison.current.totalReach, growth: comparison.kpiGrowth.totalReach },
    { label: copy.engagement, value: comparison.current.totalEngagement, growth: comparison.kpiGrowth.totalEngagement },
    { label: copy.audience, value: comparison.current.totalFollowers, growth: comparison.kpiGrowth.totalFollowers },
    { label: copy.audienceGrowth, value: comparison.current.followerGrowth, growth: calculateGrowth(comparison.current.followerGrowth, comparison.previous?.followerGrowth) },
    { label: copy.rate, value: comparison.current.engagementRate, suffix: "%", growth: comparison.kpiGrowth.engagementRate },
  ];
  const views = comparison.platforms.filter((platform) => platform.current.views !== null && platform.current.views >= 0)
    .sort((a, b) => (b.current.views ?? 0) - (a.current.views ?? 0));
  const maxViews = Math.max(1, ...views.map((platform) => platform.current.views ?? 0));
  const summary = version.aiSummary;
  const narrative = summary?.summary?.trim() || version.summary?.trim();
  const summarySections = [
    { title: copy.wentWell, items: summary?.went_well ?? [], color: "#27745c" },
    { title: copy.changed, items: summary?.what_changed ?? [], color: "#4267b2" },
    { title: copy.attention, items: summary?.needs_attention ?? [], color: "#a44c45" },
    { title: copy.recommendations, items: summary?.recommendations ?? [], color: gold },
  ].map((section) => ({ ...section, items: section.items.map((item) => item.trim()).filter(Boolean) })).filter((section) => section.items.length);
  // Empty optional sections must not create dedicated pages or contents entries.
  const showSummary = options.includeSummary && Boolean(narrative || summarySections.length);
  const showPlatforms = options.includePlatforms && comparison.platforms.length > 0;
  const showDetails = options.includeDetails && data.metrics.length > 0;
  const sections = [
    ...(showSummary ? [copy.summary] : []),
    ...(showPlatforms ? [copy.platforms] : []),
    ...(showDetails ? [copy.details] : []),
  ];

  return <Document title={report.title} author="GrowthLab" subject={`${report.clientName} | ${formatDateRange(report.periodStart, report.periodEnd, locale)}`} creator="GrowthLab Analytics" language={locale} pageMode="useOutlines" creationDate={new Date(data.generatedAt)}>
    <Shell context={context} title={copy.overview}>
      <View style={s.hero} wrap={false}>
        <Text style={s.heroLabel}>{copy.report}</Text>
        <Text style={[s.heroTitle, { fontSize: report.title.length > 90 ? 17 : 21 }]}>{report.title}</Text>
        <View style={[s.heroMeta, row]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.heroLabel}>{copy.preparedFor}</Text>
            <Text style={s.heroValue}>{report.clientName}</Text>
            {report.companyName && report.companyName !== report.clientName && <Text style={[s.heroValue, { fontSize: 8, color: "#cbd5e1" }]}>{report.companyName}</Text>}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.heroLabel}>{copy.period}</Text>
            <Text style={s.heroValue}>{period}</Text>
            <Text style={{ color: "#e0c98f", fontSize: 7.5, marginTop: 5 }}>{`${copy.version} ${number(version.number)} · ${status}`}</Text>
          </View>
        </View>
      </View>
      <View wrap={false}>
        <Text style={[s.heading, { fontSize: 16 }]}>{copy.snapshot}</Text>
        <Text style={{ color: muted, fontSize: 8 }}>{copy.snapshotHint}</Text>
        {[kpis.slice(0, 3), kpis.slice(3)].map((group, index) => <View key={index} style={[s.grid, row]}>
          {group.map((kpi) => {
            const value = `${number(kpi.value)}${kpi.value !== null ? kpi.suffix ?? "" : ""}`;
            return <View key={kpi.label} style={s.kpi}>
              <Text style={s.kpiLabel}>{kpi.label}</Text>
              <Text style={[s.kpiValue, { textAlign: direction.textAlign, fontSize: value.length > 13 ? 12 : value.length > 10 ? 16 : 20 }]}>{value}</Text>
              <Growth context={context} growth={kpi.growth} />
            </View>;
          })}
        </View>)}
        <Text style={s.note}>{previous ? `${copy.comparison} ${previous}` : copy.noComparison}</Text>
        <Text style={[s.note, { marginTop: 3 }]}>{`${number(data.metrics.length)} ${copy.reviewed}${data.excludedMetrics ? ` · ${number(data.excludedMetrics)} ${copy.excluded}` : ""}`}</Text>
      </View>
      {draft && <Text style={s.callout}>{copy.draftNote}</Text>}
      {sections.length > 0 && <Text style={s.contents}>{`${copy.contents}: ${sections.join(" / ")}`}</Text>}
      <Methodology context={context} />
    </Shell>

    {(showSummary || showPlatforms) && <Shell context={context} title={copy.report}>
    {showSummary && <View>
      <SectionTitle title={copy.summary} hint={copy.summaryHint} />
      <View style={s.summaryLead}>
        {paragraphs(narrative || "").map((paragraph, index) => <Text key={index} style={s.prose} orphans={2} widows={2}>{paragraph}</Text>)}
      </View>
      {summarySections.map((section) => <View key={section.title}>
        <View style={[s.summaryHeading, row]} wrap={false} minPresenceAhead={30}>
          <View style={[s.marker, { backgroundColor: section.color }]} />
          <Text style={{ fontSize: 10, fontWeight: 700 }}>{section.title}</Text>
        </View>
        {section.items.map((item, index) => <View key={index} style={[s.listItem, row]}>
          <Text style={s.listNumber}>{number(index + 1)}</Text>
          <Text style={s.listText} orphans={2} widows={2}>{item}</Text>
        </View>)}
      </View>)}
    </View>}

    {showPlatforms && <View style={{ marginTop: showSummary ? 18 : 0 }}>
      <SectionTitle title={copy.platforms} hint={copy.platformsHint} keepAhead={160} />
      <View>
        <View wrap={false} minPresenceAhead={30}>
        <Text style={[s.intro, { fontSize: 7, marginBottom: 6 }]}>{views.length ? copy.viewDistributionHint : copy.noViews}</Text>
        <View style={[s.tableHead, row]}>
          {[copy.platform, copy.views, copy.reach, copy.engagement, copy.followers].map((label, index) => <Text key={label} style={[s.cell, { width: index === 0 ? "24%" : "19%", textAlign: index === 0 ? direction.textAlign : "right" }]}>{label}</Text>)}
        </View>
        </View>
        {comparison.platforms.map((platform, platformIndex) => <View key={platform.platform} wrap={false} style={[s.tableRow, row, { backgroundColor: platformIndex % 2 ? "#f8fafc" : "#ffffff" }]}>
          <Text style={[s.cell, { width: "24%", fontWeight: 700 }]}>{dictionary.platforms[platform.platform]}</Text>
          {[
            { value: platform.current.views, growth: platform.viewsGrowth },
            { value: platform.current.reach },
            { value: platform.current.engagement, growth: platform.engagementGrowth },
            { value: platform.current.followers, growth: platform.followersGrowth },
          ].map((metric, index) => <View key={index} style={[s.cell, { width: "19%" }]}>
            <Text style={[s.numeric, { fontSize: number(metric.value).length > 14 ? 6.5 : 8 }]}>{number(metric.value)}</Text>
            {index === 0 && metric.value !== null && metric.value >= 0 && <View style={[s.barTrack, row]}>
              <View style={[s.bar, { backgroundColor: colors[platform.platform], width: `${metric.value / maxViews * 100}%` }]} />
            </View>}
            <Growth context={context} growth={metric.growth} align="right" />
          </View>)}
        </View>)}
        {previous && <Text style={s.note}>{copy.comparisonNote}</Text>}
      </View>
    </View>}
    </Shell>}

    {showDetails && <Shell context={context} title={copy.details} detail>
      {metricGroups(data, locale).map((group, index) => <DetailGroup key={index} context={context} group={group} />)}
    </Shell>}
  </Document>;
}

export async function renderReportPdf(data: ReportPdfData, options: ReportPdfOptions): Promise<Buffer> {
  await prepareFonts();
  return renderToBuffer(<ReportPdfDocument data={data} options={options} />);
}
