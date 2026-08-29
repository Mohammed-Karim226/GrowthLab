"use client";

import { memo, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, ArrowUpRight, BrainCircuit, ChartNoAxesCombined, Eye, Lightbulb, Radar, ShieldAlert, Sparkles, Target, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCompact, formatPercent, formatSignedPercent, humanizeMetricName } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { Platform } from "@/types/database";

export type IntelligenceMetric = { platform: Platform; name: string; value: number | null; unit: string; confidence: number | null };
export type IntelligencePeriod = { reportId: string; title: string; periodStart: string; periodEnd: string; metrics: IntelligenceMetric[] };
type View = "discoveries" | "risks" | "opportunities" | "scenario";
type Severity = "critical" | "high" | "moderate" | "positive" | "informational";
type Signal = { id: string; platform: Platform; metric: string; unit: string; current: number; previous: number; change: number; severity: Severity };

const AVERAGE_UNITS = new Set(["percent", "seconds", "minutes", "hours"]);
const SCENARIO_METRICS = ["views", "reach", "engagement", "followers"] as const;
const HORIZONS = [30, 60, 90] as const;

function aggregate(metrics: IntelligenceMetric[]) {
  const groups = new Map<string, IntelligenceMetric[]>();
  for (const metric of metrics) {
    if (metric.value === null) continue;
    const key = `${metric.platform}:${metric.name}`;
    groups.set(key, [...(groups.get(key) ?? []), metric]);
  }
  return new Map([...groups].map(([key, rows]) => {
    const values = rows.map((row) => Number(row.value));
    const value = AVERAGE_UNITS.has(rows[0].unit) ? values.reduce((sum, item) => sum + item, 0) / values.length : values.reduce((sum, item) => sum + item, 0);
    return [key, { ...rows[0], value }];
  }));
}

function totalMetric(period: IntelligencePeriod, metricName: string) {
  const values = period.metrics.filter((metric) => metric.name === metricName && metric.value !== null).map((metric) => Number(metric.value));
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function deriveSignals(periods: IntelligencePeriod[]) {
  const current = periods[0];
  const previous = periods[1];
  if (!current || !previous) return [];
  const currentIndex = aggregate(current.metrics);
  const previousIndex = aggregate(previous.metrics);
  const signals: Signal[] = [];
  for (const [key, metric] of currentIndex) {
    const prior = previousIndex.get(key);
    if (metric.value === null || prior?.value === null || prior?.value === undefined || Number(prior.value) === 0) continue;
    const change = ((Number(metric.value) - Number(prior.value)) / Math.abs(Number(prior.value))) * 100;
    const severity: Severity = change <= -35 ? "critical" : change <= -20 ? "high" : change < -8 ? "moderate" : change >= 8 ? "positive" : "informational";
    signals.push({ id: key, platform: metric.platform, metric: metric.name, unit: metric.unit, current: Number(metric.value), previous: Number(prior.value), change, severity });
  }
  return signals;
}

const FindingCard = memo(function FindingCard({ title, description, evidence, href, severity, severityLabel, icon: Icon }: { title: string; description: string; evidence: string; href: string; severity: Severity; severityLabel: string; icon: typeof TrendingUp }) {
  const badge = severity === "critical" ? "destructive" : severity === "high" || severity === "moderate" ? "warning" : severity === "positive" ? "success" : "secondary";
  const tone = severity === "critical" ? "text-red-300 bg-red-400/10" : severity === "high" || severity === "moderate" ? "text-amber-300 bg-amber-400/10" : severity === "positive" ? "text-emerald-300 bg-emerald-400/10" : "text-cyan-200 bg-cyan-300/10";
  return <Card size="sm" className="border-0 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_14px_30px_rgba(0,0,0,0.14)] ring-0"><CardHeader><span className={cn("flex size-10 items-center justify-center rounded-[14px]", tone)}><Icon className="size-[18px]" /></span><CardAction><Badge variant={badge}>{severityLabel}</Badge></CardAction><CardTitle className="mt-3 text-sm text-white">{title}</CardTitle><CardDescription className="text-xs leading-relaxed text-slate-400">{description}</CardDescription></CardHeader><CardContent className="flex items-center justify-between gap-3"><span className="truncate text-[10px] text-slate-500">{evidence}</span><Link href={href} aria-label={evidence} className={buttonVariants({ variant: "ghost", size: "xs" })}><Eye className="size-3" /></Link></CardContent></Card>;
});

export default function IntelligenceCenter({ periods }: { periods: IntelligencePeriod[] }) {
  const rawLocale = useLocale();
  const locale = (rawLocale === "ar" ? "ar" : "en") as Locale;
  const t = useTranslations("portal.intelligenceCenter");
  const tMetrics = useTranslations("metrics");
  const tPlatforms = useTranslations("platforms");
  const [view, setView] = useState<View>("discoveries");
  const [scenarioMetric, setScenarioMetric] = useState<(typeof SCENARIO_METRICS)[number]>("views");
  const [executionChange, setExecutionChange] = useState(15);
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(30);
  const current = periods[0];
  const signals = useMemo(() => deriveSignals(periods), [periods]);
  const risks = useMemo(() => signals.filter((signal) => signal.change < -8).sort((a, b) => a.change - b.change), [signals]);
  const opportunities = useMemo(() => signals.filter((signal) => signal.change >= 8).sort((a, b) => b.change - a.change), [signals]);
  const discoveries = useMemo(() => [...signals].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 8), [signals]);
  const averageConfidence = useMemo(() => {
    const values = current?.metrics.flatMap((metric) => metric.confidence === null ? [] : [metric.confidence]) ?? [];
    const dataScore = Math.min(95, 42 + periods.length * 7 + Math.min(current?.metrics.length ?? 0, 18));
    return Math.round(values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length) * 60 + dataScore * 0.4 : dataScore);
  }, [current, periods.length]);
  const riskScore = useMemo(() => Math.min(100, risks.reduce((sum, signal) => sum + (signal.severity === "critical" ? 28 : signal.severity === "high" ? 18 : 9), 0)), [risks]);
  const metricLabel = useCallback((name: string) => tMetrics.has(name as never) ? tMetrics(name as never) : humanizeMetricName(name), [tMetrics]);
  const scenario = useMemo(() => {
    const baseline = current ? totalMetric(current, scenarioMetric) : null;
    const chronological = [...periods].reverse().map((period) => totalMetric(period, scenarioMetric)).filter((value): value is number => value !== null);
    const growthRates = chronological.slice(1).flatMap((value, index) => chronological[index] === 0 ? [] : [(value - chronological[index]) / Math.abs(chronological[index])]);
    const trend = growthRates.length ? Math.max(-0.35, Math.min(0.35, growthRates.reduce((sum, value) => sum + value, 0) / growthRates.length)) : 0;
    const projected = baseline === null ? null : Math.max(0, baseline * (1 + trend * (horizon / 30)) * (1 + (executionChange / 100) * 0.35));
    return { baseline, projected, delta: baseline && projected !== null ? ((projected - baseline) / Math.abs(baseline)) * 100 : null, trend: trend * 100 };
  }, [current, executionChange, horizon, periods, scenarioMetric]);
  const selectView = useCallback((next: View) => setView(next), []);
  const renderSignal = useCallback((signal: Signal, kind: "discovery" | "risk" | "opportunity") => {
    if (!current) return null;
    const title = t(`${kind}Title`, { metric: metricLabel(signal.metric), platform: tPlatforms(signal.platform) });
    const description = t(`${kind}Description`, { change: formatSignedPercent(signal.change, locale), current: signal.unit === "percent" ? formatPercent(signal.current, locale) : formatCompact(signal.current, locale) });
    const severity = kind === "opportunity" ? "positive" : signal.severity;
    return <FindingCard key={`${kind}:${signal.id}`} title={title} description={description} evidence={t("evidence", { report: current.title })} href={`/${locale}/portal/reports/${current.reportId}`} severity={severity} severityLabel={t(`severity.${severity}`)} icon={kind === "risk" ? TrendingDown : kind === "opportunity" ? TrendingUp : Sparkles} />;
  }, [current, locale, metricLabel, t, tPlatforms]);
  const renderDiscovery = useCallback((signal: Signal) => renderSignal(signal, "discovery"), [renderSignal]);
  const renderRisk = useCallback((signal: Signal) => renderSignal(signal, "risk"), [renderSignal]);
  const renderOpportunity = useCallback((signal: Signal) => renderSignal(signal, "opportunity"), [renderSignal]);

  const tabs: Array<{ key: View; icon: typeof BrainCircuit }> = [{ key: "discoveries", icon: BrainCircuit }, { key: "risks", icon: Radar }, { key: "opportunities", icon: Lightbulb }, { key: "scenario", icon: ChartNoAxesCombined }];
  if (!current) return <Card className="border-0 bg-white/[0.035] ring-0"><CardHeader><CardTitle className="text-white">{t("emptyTitle")}</CardTitle><CardDescription>{t("emptyHint")}</CardDescription></CardHeader></Card>;

  return <div className="space-y-6">
    <Card className="border-0 bg-[#090e1b]/90 shadow-[0_24px_60px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)] ring-0"><CardHeader><Badge variant="secondary"><ShieldAlert className="size-3" />{t("private")}</Badge><CardTitle className="mt-3 font-satoshi text-2xl text-white sm:text-3xl">{t("title")}</CardTitle><CardDescription className="max-w-2xl text-sm leading-relaxed">{t("subtitle")}</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><SummaryCard label={t("confidence")} value={`${averageConfidence}%`} icon={Target} tone="cyan" /><SummaryCard label={t("riskScore")} value={`${riskScore}/100`} icon={AlertTriangle} tone={riskScore >= 50 ? "amber" : "emerald"} /><SummaryCard label={t("signals")} value={String(signals.length)} icon={BrainCircuit} tone="violet" /></CardContent></Card>

    <Card size="sm" className="border-0 bg-white/[0.025] ring-0"><CardContent className="grid gap-1 p-1.5 sm:grid-cols-4">{tabs.map(({ key, icon: Icon }) => <Button key={key} type="button" variant={view === key ? "default" : "ghost"} onClick={() => selectView(key)} className="justify-start sm:justify-center"><Icon className="size-4" />{t(`tabs.${key}`)}</Button>)}</CardContent></Card>

    {view === "discoveries" && <SignalGrid signals={discoveries} empty={t("noDiscoveries")} render={renderDiscovery} />}
    {view === "risks" && <SignalGrid signals={risks} empty={t("noRisks")} render={renderRisk} />}
    {view === "opportunities" && <SignalGrid signals={opportunities} empty={t("noOpportunities")} render={renderOpportunity} />}
    {view === "scenario" && <Card className="border-0 bg-white/[0.035] ring-0"><CardHeader><CardTitle className="flex items-center gap-2 text-white"><ChartNoAxesCombined className="size-5 text-violet-300" />{t("scenario.title")}</CardTitle><CardDescription>{t("scenario.hint")}</CardDescription></CardHeader><CardContent className="space-y-6"><FieldGroup className="grid gap-4 md:grid-cols-3"><Field><FieldLabel>{t("scenario.metric")}</FieldLabel><Select value={scenarioMetric} onValueChange={(value) => value && setScenarioMetric(value as typeof scenarioMetric)} items={SCENARIO_METRICS.map((value) => ({ value, label: metricLabel(value) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SCENARIO_METRICS.map((value) => <SelectItem key={value} value={value}>{metricLabel(value)}</SelectItem>)}</SelectContent></Select></Field><Field><FieldLabel>{t("scenario.execution")}</FieldLabel><Input type="number" min={-50} max={100} value={executionChange} onChange={(event) => setExecutionChange(Math.max(-50, Math.min(100, Number(event.target.value) || 0)))} /></Field><Field><FieldLabel>{t("scenario.horizon")}</FieldLabel><Select value={String(horizon)} onValueChange={(value) => value && setHorizon(Number(value) as typeof horizon)} items={HORIZONS.map((value) => ({ value: String(value), label: t("scenario.days", { count: value }) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{HORIZONS.map((value) => <SelectItem key={value} value={String(value)}>{t("scenario.days", { count: value })}</SelectItem>)}</SelectContent></Select></Field></FieldGroup><div className="grid gap-3 sm:grid-cols-3"><SummaryCard label={t("scenario.baseline")} value={formatCompact(scenario.baseline, locale)} icon={Eye} tone="cyan" /><SummaryCard label={t("scenario.projected")} value={formatCompact(scenario.projected, locale)} icon={Target} tone="violet" /><SummaryCard label={t("scenario.estimatedChange")} value={formatSignedPercent(scenario.delta, locale)} icon={ArrowUpRight} tone={scenario.delta !== null && scenario.delta < 0 ? "amber" : "emerald"} /></div><Badge variant="outline" className="whitespace-normal text-slate-400">{t("scenario.disclaimer", { trend: formatSignedPercent(scenario.trend, locale) })}</Badge></CardContent></Card>}
  </div>;
}

const SummaryCard = memo(function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Target; tone: "cyan" | "violet" | "emerald" | "amber" }) {
  const classes = { cyan: "text-cyan-200 bg-cyan-300/10", violet: "text-violet-200 bg-violet-300/10", emerald: "text-emerald-200 bg-emerald-300/10", amber: "text-amber-200 bg-amber-300/10" }[tone];
  return <Field className="flex-row items-center gap-3 rounded-[16px] bg-white/[0.03] p-3"><span className={cn("flex size-10 shrink-0 items-center justify-center rounded-[14px]", classes)}><Icon className="size-[18px]" /></span><span><span className="block text-[10px] font-semibold tracking-[0.12em] text-slate-500 uppercase">{label}</span><span className="mt-1 block font-satoshi text-2xl text-white tabular-nums">{value}</span></span></Field>;
});

const SignalGrid = memo(function SignalGrid({ signals, empty, render }: { signals: Signal[]; empty: string; render: (signal: Signal) => React.ReactNode }) {
  if (!signals.length) return <Card className="border-0 bg-white/[0.03] ring-0"><CardContent className="py-12 text-center text-sm text-slate-500">{empty}</CardContent></Card>;
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{signals.map(render)}</div>;
});
