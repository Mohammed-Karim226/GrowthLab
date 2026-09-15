"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { Platform, MetricRow } from "@/types/database";
import type { PublishedPeriod, PortalMetric } from "@/lib/portal/data";
import { comparePeriods, buildTrendSeries } from "@/lib/analytics/comparisons";
import { buildMetricSeries } from "@/lib/portal/series";
import { humanizeMetricName } from "@/lib/format";
import KpiGrid from "@/components/portal/KpiGrid";
import PerformanceLineChart from "@/components/portal/charts/PerformanceLineChart";
import PlatformComparisonChart from "@/components/portal/charts/PlatformComparisonChart";
import MetricTrendChart from "@/components/portal/charts/MetricTrendChart";
import PlatformBreakdown from "@/components/portal/PlatformBreakdown";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PeriodData = PublishedPeriod & { metrics: PortalMetric[] };
const platforms: Array<Platform | "all"> = ["all", "facebook", "instagram", "tiktok", "youtube"];

export default function AnalyticsWorkspace({ locale, periods }: { locale: Locale; periods: PeriodData[] }) {
  const t = useTranslations("portal.filters");
  const tPlatforms = useTranslations("platforms");
  const tMetrics = useTranslations("metrics");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [account, setAccount] = useState("all");
  const [metric, setMetric] = useState("all");
  const [comparisonMode, setComparisonMode] = useState<"previous" | "mom" | "qoq" | "yoy">("previous");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const accounts = [...new Map(periods.flatMap((period) => period.metrics).filter((row) => row.accountId).map((row) => [row.accountId as string, row.accountName ?? (row.accountId as string)])).entries()].map(([value, label]) => ({ value, label }));
  const metricNames = [...new Set(periods.flatMap((period) => period.metrics.map((row) => row.metric_name)))].sort();
  const metricLabel = (name: string) => tMetrics.has(name as never) ? tMetrics(name as never) : humanizeMetricName(name);
  const hasFilters = platform !== "all" || account !== "all" || metric !== "all" || comparisonMode !== "previous" || Boolean(from || to);
  const filtered = useMemo(() => periods.filter((period) => (!from || period.periodEnd >= from) && (!to || period.periodStart <= to)).map((period) => ({ ...period, metrics: period.metrics.filter((row) => (platform === "all" || row.platform === platform) && (account === "all" || row.accountId === account) && (metric === "all" || row.metric_name === metric)) })), [periods, platform, account, metric, from, to]);
  const current = filtered[0];
  const previous = comparisonMode === "previous" ? filtered[1] : filtered.find((period, index) => index > 0 && (comparisonMode === "mom" ? period.periodEnd.slice(0, 7) !== current?.periodEnd.slice(0, 7) : comparisonMode === "qoq" ? Math.abs(new Date(period.periodEnd).getTime() - new Date(current?.periodEnd ?? period.periodEnd).getTime()) >= 70 * 86400000 : Math.abs(new Date(period.periodEnd).getTime() - new Date(current?.periodEnd ?? period.periodEnd).getTime()) >= 330 * 86400000));
  if (!current) return <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-[#77766f]">{t("empty")}</p>;
  const comparison = comparePeriods(current.metrics as MetricRow[], previous?.metrics as MetricRow[] ?? null);
  const chronological = [...filtered].reverse();
  const trend = buildTrendSeries(chronological.map((period) => ({ ...period, metrics: period.metrics as MetricRow[] })));
  const series = buildMetricSeries(chronological.map((period) => ({ label: period.title, metrics: period.metrics as MetricRow[] })));
  return <div className="space-y-6"><section className="portal-chart-card overflow-visible rounded-[24px] border border-white/[0.1] p-4 sm:p-5" aria-label={t("filterTitle")}><div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl border border-cyan-200/20 bg-cyan-200/[0.08] text-cyan-100"><SlidersHorizontal className="size-4" /></span><div><p className="text-[9px] font-semibold tracking-[0.18em] text-cyan-100/65 uppercase">{t("filterEyebrow")}</p><h2 className="mt-0.5 text-sm font-semibold text-white">{t("filterTitle")}</h2></div></div>{hasFilters && <Button type="button" variant="ghost" size="sm" onClick={() => { setPlatform("all"); setAccount("all"); setMetric("all"); setComparisonMode("previous"); setFrom(""); setTo(""); }}><RotateCcw className="size-3.5" />{t("reset")}</Button>}</div><FieldGroup className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Field><FieldLabel className="text-[10px] font-medium text-slate-400">{t("platform")}</FieldLabel><Select value={platform} onValueChange={(value) => value && setPlatform(value as Platform | "all")} items={platforms.map((value) => ({ value, label: value === "all" ? t("allPlatforms") : tPlatforms(value) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{platforms.map((value) => <SelectItem key={value} value={value}>{value === "all" ? t("allPlatforms") : tPlatforms(value)}</SelectItem>)}</SelectContent></Select></Field><Field><FieldLabel className="text-[10px] font-medium text-slate-400">{t("account")}</FieldLabel><Select value={account} onValueChange={(value) => value && setAccount(value)} items={[{ value: "all", label: t("allAccounts") }, ...accounts]}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("allAccounts")}</SelectItem>{accounts.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field><Field><FieldLabel className="text-[10px] font-medium text-slate-400">{t("metric")}</FieldLabel><Select value={metric} onValueChange={(value) => value && setMetric(value)} items={[{ value: "all", label: t("allMetrics") }, ...metricNames.map((value) => ({ value, label: metricLabel(value) }))]}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("allMetrics")}</SelectItem>{metricNames.map((value) => <SelectItem key={value} value={value}>{metricLabel(value)}</SelectItem>)}</SelectContent></Select></Field><Field><FieldLabel className="text-[10px] font-medium text-slate-400">{t("comparison")}</FieldLabel><Select value={comparisonMode} onValueChange={(value) => value && setComparisonMode(value as typeof comparisonMode)} items={[{ value: "previous", label: t("previous") }, { value: "mom", label: t("mom") }, { value: "qoq", label: t("qoq") }, { value: "yoy", label: t("yoy") }]}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="previous">{t("previous")}</SelectItem><SelectItem value="mom">{t("mom")}</SelectItem><SelectItem value="qoq">{t("qoq")}</SelectItem><SelectItem value="yoy">{t("yoy")}</SelectItem></SelectContent></Select></Field><Field className="sm:col-span-2 xl:col-span-1"><FieldLabel className="text-[10px] font-medium text-slate-400"><span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5 text-cyan-100/70" />{t("dateRange")}</span></FieldLabel><div className="grid grid-cols-2 gap-2"><DateFilterField value={from} onChange={setFrom} label={t("from")} placeholder={t("datePlaceholder")} clearLabel={t("clearDate")} /><DateFilterField value={to} onChange={setTo} label={t("to")} placeholder={t("datePlaceholder")} clearLabel={t("clearDate")} /></div></Field></FieldGroup></section><KpiGrid locale={locale} comparison={comparison} compact /><div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]"><PerformanceLineChart locale={locale} points={trend} /><PlatformComparisonChart locale={locale} platforms={comparison.platforms.map((item) => ({ platform: item.platform, views: item.current.views, reach: item.current.reach, engagement: item.current.engagement, followers: item.current.followers }))} /></div>{series.length > 0 && <MetricTrendChart locale={locale} series={series} />}<PlatformBreakdown locale={locale} platforms={comparison.platforms} metrics={comparison.metrics} /></div>;
}

function DateFilterField({ value, onChange, label, placeholder, clearLabel }: { value: string; onChange: (value: string) => void; label: string; placeholder: string; clearLabel: string }) {
  const selected = value ? parseLocalDate(value) : undefined;
  return <Popover><PopoverTrigger render={<Button type="button" variant="outline" className="h-10 w-full justify-start gap-2 border-white/[0.14] bg-white/[0.035] px-2.5 text-start text-xs font-normal text-slate-200 hover:bg-white/[0.08]" />}><CalendarDays className="size-3.5 shrink-0 text-cyan-100/70" /><span className={value ? "truncate" : "truncate text-slate-500"}>{value || placeholder}</span></PopoverTrigger><PopoverContent className="w-auto p-2"><div className="flex items-center justify-between gap-5 border-b border-white/[0.08] px-2 pb-2"><span className="text-[10px] font-semibold tracking-[0.12em] text-slate-400 uppercase">{label}</span>{value && <button type="button" onClick={() => onChange("")} aria-label={clearLabel} title={clearLabel} className="inline-flex size-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/[0.08] hover:text-white"><X className="size-3.5" /></button>}</div><Calendar mode="single" selected={selected} onSelect={(date) => date && onChange(formatLocalDate(date))} defaultMonth={selected} /></PopoverContent></Popover>;
}

function parseLocalDate(value: string) { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); }
function formatLocalDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
