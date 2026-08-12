"use client";

import { useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight, ChartNoAxesColumnIncreasing, Minus } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { formatCompact, humanizeMetricName } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { ChartFrame, ChartTooltip, Tooltip, categoryAxis, chartGrid, valueAxis } from "./chart-parts";

export type MetricSeries = { metricName: string; points: Array<{ label: string; value: number | null }> };

export default function MetricTrendChart({ locale, series }: { locale: Locale; series: MetricSeries[] }) {
  const t = useTranslations("portal.charts");
  const tMetrics = useTranslations("metrics");
  const tDetail = useTranslations("portal.detail");
  const available = series.filter((entry) => entry.points.filter((point) => point.value !== null).length >= 2);
  const [selected, setSelected] = useState(available[0]?.metricName ?? "");
  const active = available.find((entry) => entry.metricName === selected) ?? available[0];
  const labelFor = (name: string) => tMetrics.has(name as never) ? tMetrics(name as never) : humanizeMetricName(name);
  const values = active?.points.flatMap((point) => point.value === null ? [] : [point.value]) ?? [];
  const current = values.at(-1) ?? null;
  const previous = values.at(-2) ?? null;
  const change = current !== null && previous !== null && previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : null;
  const ChangeIcon = change === null || change === 0 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
  const maximum = Math.max(...values, 0);

  const picker = available.length > 1 ? <div className="scrollbar-slim flex max-w-full gap-1.5 overflow-x-auto pb-1">
    {available.map((entry) => <button key={entry.metricName} type="button" onClick={() => setSelected(entry.metricName)} aria-pressed={entry.metricName === active?.metricName} className={cn("inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-medium transition-all", entry.metricName === active?.metricName ? "border-[#d8be78]/25 bg-[#d8be78]/10 text-[#e4ce91]" : "border-white/[0.06] text-[#696861] hover:bg-white/[0.04] hover:text-[#c8c4b9]")}><ChartNoAxesColumnIncreasing className="size-3" aria-hidden />{labelFor(entry.metricName)}</button>)}
  </div> : undefined;

  return <ChartFrame title={t("metricTitle")} hint={t("metricHint")} action={picker} isEmpty={!active} emptyLabel={t("trendEmpty")} responsive={false}>
    <div className="grid min-h-0 gap-3 sm:gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="relative overflow-hidden rounded-[20px] border border-white/[0.06] bg-gradient-to-br from-white/[0.045] to-transparent p-5">
        <div aria-hidden className="absolute -end-8 -top-8 size-28 rounded-full bg-[#d8be78]/10 blur-3xl" />
        <span className="relative flex size-10 items-center justify-center rounded-[14px] border border-[#d8be78]/15 bg-[#d8be78]/10 text-[#dec378]"><ChartNoAxesColumnIncreasing className="size-[18px]" strokeWidth={1.8} aria-hidden /></span>
        <p className="relative mt-6 text-[9px] font-semibold tracking-[0.14em] text-[#696861] uppercase">{active ? labelFor(active.metricName) : ""}</p>
        <p className="relative mt-2 font-satoshi text-4xl tracking-[-0.055em] tabular-nums text-[#f4f0e7]">{formatCompact(current, locale)}</p>
        <div className="relative mt-5 flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-semibold tabular-nums", change !== null && change > 0 && "bg-[#54d8ac]/10 text-[#68dcb7]", change !== null && change < 0 && "bg-[#ed8f6d]/10 text-[#ef9a7a]", (change === null || change === 0) && "bg-white/[0.04] text-[#77766f]")}><ChangeIcon className="size-3" aria-hidden />{change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`}</span>
          <span className="text-[9px] text-[#5f5e58]">{tDetail("previous")}</span>
        </div>
      </div>
      <div className="h-[250px] min-w-0 rounded-[18px] border border-white/[0.05] bg-[#090a08]/50 p-2 sm:h-[280px] sm:rounded-[20px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={active?.points ?? []} margin={{ top: 20, right: 12, bottom: 4, left: 8 }} barCategoryGap="28%">
            <defs><linearGradient id="metric-columns" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0d993" /><stop offset="100%" stopColor="#9e7e3e" /></linearGradient></defs>
            {chartGrid()}{categoryAxis(locale)}{valueAxis(locale)}<Tooltip cursor={{ fill: "rgba(216,190,120,0.045)" }} content={<ChartTooltip locale={locale} />} />
            <Bar dataKey="value" name={active ? labelFor(active.metricName) : ""} radius={[10, 10, 4, 4]} maxBarSize={46} animationDuration={900}>
              {(active?.points ?? []).map((point, index) => <Cell key={`${point.label}-${index}`} fill={point.value === maximum ? "#ead48f" : "url(#metric-columns)"} fillOpacity={point.value === maximum ? 1 : 0.62} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </ChartFrame>;
}
