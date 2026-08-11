"use client";

import { useState } from "react";
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { formatCompact, humanizeMetricName } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import {
  CHART_COLORS,
  ChartFrame,
  ChartTooltip,
  Tooltip,
  categoryAxis,
  chartGradient,
  chartGrid,
  valueAxis,
} from "./chart-parts";

export type MetricSeries = {
  metricName: string;
  points: Array<{ label: string; value: number | null }>;
};

export default function MetricTrendChart({
  locale,
  series,
}: {
  locale: Locale;
  series: MetricSeries[];
}) {
  const t = useTranslations("portal.charts");
  const tMetrics = useTranslations("metrics");
  const tDetail = useTranslations("portal.detail");

  const available = series.filter(
    (entry) => entry.points.filter((point) => point.value !== null).length >= 2
  );
  const [selected, setSelected] = useState(available[0]?.metricName ?? "");
  const active = available.find((entry) => entry.metricName === selected) ?? available[0];

  function labelFor(metricName: string) {
    return tMetrics.has(metricName as never)
      ? tMetrics(metricName as never)
      : humanizeMetricName(metricName);
  }

  const values = active?.points.flatMap((point) => point.value === null ? [] : [point.value]) ?? [];
  const current = values.at(-1) ?? null;
  const previous = values.at(-2) ?? null;
  const change = current !== null && previous !== null && previous !== 0
    ? ((current - previous) / Math.abs(previous)) * 100
    : null;
  const ChangeIcon = change === null || change === 0 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;

  const picker = available.length > 1 ? (
    <div className="scrollbar-slim -mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-1">
      {available.map((entry) => (
        <button
          key={entry.metricName}
          type="button"
          onClick={() => setSelected(entry.metricName)}
          aria-pressed={entry.metricName === active?.metricName}
          className={cn(
            "whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-medium tracking-wide transition-all",
            entry.metricName === active?.metricName
              ? "border-[#d8be78]/25 bg-[#d8be78]/10 text-[#e4ce91] shadow-[0_8px_24px_rgba(216,190,120,0.08)]"
              : "border-white/[0.07] text-[#77766f] hover:bg-white/[0.04] hover:text-[#c8c4b9]"
          )}
        >
          {labelFor(entry.metricName)}
        </button>
      ))}
    </div>
  ) : undefined;

  return (
    <ChartFrame
      title={t("metricTitle")}
      hint={t("metricHint")}
      action={picker}
      isEmpty={!active}
      emptyLabel={t("trendEmpty")}
      responsive={false}
    >
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 lg:grid-cols-[190px_minmax(0,1fr)] lg:grid-rows-1 lg:gap-4">
          <div className="flex flex-row items-end justify-between rounded-[16px] border border-white/[0.055] bg-black/15 p-3 lg:my-2 lg:flex-col lg:items-stretch lg:rounded-[20px] lg:p-4">
          <div>
            <p className="text-[9px] font-semibold tracking-[0.14em] text-[#696861] uppercase">
              {active ? labelFor(active.metricName) : ""}
            </p>
            <p className="mt-3 font-satoshi text-3xl tracking-[-0.05em] tabular-nums text-[#f2efe7]">
              {current === null ? "—" : formatCompact(current, locale)}
            </p>
          </div>
          <div className="text-end lg:mt-6 lg:text-start">
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold tabular-nums",
              change !== null && change > 0 && "border-[#54d8ac]/10 bg-[#54d8ac]/[0.07] text-[#68dcb7]",
              change !== null && change < 0 && "border-[#ed8f6d]/10 bg-[#ed8f6d]/[0.07] text-[#ef9a7a]",
              (change === null || change === 0) && "border-white/[0.06] bg-white/[0.03] text-[#77766f]"
            )}>
              <ChangeIcon className="size-3" aria-hidden />
              {change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`}
            </span>
            <p className="mt-2 text-[9px] leading-relaxed text-[#5f5e58]">{tDetail("previous")}</p>
          </div>
        </div>

        <div className="min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={active?.points ?? []} margin={{ top: 14, right: 8, bottom: 0, left: 8 }}>
              <defs>{chartGradient("metric-spotlight-fill", CHART_COLORS.views, 0.32)}</defs>
              {chartGrid()}
              {categoryAxis(locale)}
              {valueAxis(locale)}
              {current !== null && <ReferenceLine y={current} stroke="rgba(216,190,120,0.2)" strokeDasharray="4 7" />}
              <Tooltip content={<ChartTooltip locale={locale} />} />
              <Area type="monotone" dataKey="value" name={active ? labelFor(active.metricName) : ""} stroke="transparent" fill="url(#metric-spotlight-fill)" connectNulls={false} isAnimationActive animationDuration={900} />
              <Line type="monotone" dataKey="value" name={active ? labelFor(active.metricName) : ""} stroke={CHART_COLORS.views} strokeWidth={3} dot={{ r: 3, strokeWidth: 2, stroke: "#11120f", fill: CHART_COLORS.views }} activeDot={{ r: 6, strokeWidth: 3, stroke: "#11120f" }} connectNulls={false} isAnimationActive animationDuration={1050} animationEasing="ease-out" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartFrame>
  );
}
