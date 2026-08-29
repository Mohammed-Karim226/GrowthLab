"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/lib/i18n";
import type { Platform, MetricRow } from "@/types/database";
import type { PublishedPeriod, PortalMetric } from "@/lib/portal/data";
import { comparePeriods, buildTrendSeries } from "@/lib/analytics/comparisons";
import { buildMetricSeries } from "@/lib/portal/series";
import KpiGrid from "@/components/portal/KpiGrid";
import PerformanceLineChart from "@/components/portal/charts/PerformanceLineChart";
import PlatformComparisonChart from "@/components/portal/charts/PlatformComparisonChart";
import MetricTrendChart from "@/components/portal/charts/MetricTrendChart";
import PlatformBreakdown from "@/components/portal/PlatformBreakdown";

type PeriodData = PublishedPeriod & { metrics: PortalMetric[] };
const platforms: Array<Platform | "all"> = ["all", "facebook", "instagram", "tiktok", "youtube"];

export default function AnalyticsWorkspace({ locale, periods }: { locale: Locale; periods: PeriodData[] }) {
  const t = useTranslations("portal.filters");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [account, setAccount] = useState("all");
  const [metric, setMetric] = useState("all");
  const [comparisonMode, setComparisonMode] = useState<"previous" | "mom" | "qoq" | "yoy">("previous");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const accounts = [...new Set(periods.flatMap((period) => period.metrics.map((row) => row.accountId).filter(Boolean) as string[]))];
  const metricNames = [...new Set(periods.flatMap((period) => period.metrics.map((row) => row.metric_name)))].sort();
  const filtered = useMemo(() => periods.filter((period) => (!from || period.periodEnd >= from) && (!to || period.periodStart <= to)).map((period) => ({ ...period, metrics: period.metrics.filter((row) => (platform === "all" || row.platform === platform) && (account === "all" || row.accountId === account) && (metric === "all" || row.metric_name === metric)) })), [periods, platform, account, metric, from, to]);
  const current = filtered[0];
  const previous = comparisonMode === "previous" ? filtered[1] : filtered.find((period, index) => index > 0 && (comparisonMode === "mom" ? period.periodEnd.slice(0, 7) !== current?.periodEnd.slice(0, 7) : comparisonMode === "qoq" ? Math.abs(new Date(period.periodEnd).getTime() - new Date(current?.periodEnd ?? period.periodEnd).getTime()) >= 70 * 86400000 : Math.abs(new Date(period.periodEnd).getTime() - new Date(current?.periodEnd ?? period.periodEnd).getTime()) >= 330 * 86400000));
  if (!current) return <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-[#77766f]">{t("empty")}</p>;
  const comparison = comparePeriods(current.metrics as MetricRow[], previous?.metrics as MetricRow[] ?? null);
  const chronological = [...filtered].reverse();
  const trend = buildTrendSeries(chronological.map((period) => ({ ...period, metrics: period.metrics as MetricRow[] })));
  const series = buildMetricSeries(chronological.map((period) => ({ label: period.title, metrics: period.metrics as MetricRow[] })));
  return <div className="space-y-6"><div className="grid gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.025] p-3 sm:grid-cols-2 lg:grid-cols-5"><select value={platform} onChange={(e) => setPlatform(e.target.value as Platform | "all")} className="filter-select"><option value="all">{t("allPlatforms")}</option>{platforms.slice(1).map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={account} onChange={(e) => setAccount(e.target.value)} className="filter-select"><option value="all">{t("allAccounts")}</option>{accounts.map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={metric} onChange={(e) => setMetric(e.target.value)} className="filter-select"><option value="all">{t("allMetrics")}</option>{metricNames.map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={comparisonMode} onChange={(e) => setComparisonMode(e.target.value as typeof comparisonMode)} className="filter-select"><option value="previous">{t("previous")}</option><option value="mom">{t("mom")}</option><option value="qoq">{t("qoq")}</option><option value="yoy">{t("yoy")}</option></select><div className="flex gap-2"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="filter-select min-w-0" aria-label={t("from")} /><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="filter-select min-w-0" aria-label={t("to")} /></div></div><KpiGrid locale={locale} comparison={comparison} compact /><div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]"><PerformanceLineChart locale={locale} points={trend} /><PlatformComparisonChart locale={locale} platforms={comparison.platforms.map((item) => ({ platform: item.platform, views: item.current.views, reach: item.current.reach, engagement: item.current.engagement, followers: item.current.followers }))} /></div>{series.length > 0 && <MetricTrendChart locale={locale} series={series} />}<PlatformBreakdown locale={locale} platforms={comparison.platforms} metrics={comparison.metrics} /></div>;
}
