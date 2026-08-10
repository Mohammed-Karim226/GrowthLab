"use client";

import { useState } from "react";
import { Area, AreaChart } from "recharts";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { humanizeMetricName } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import {
  CHART_COLORS,
  ChartFrame,
  ChartTooltip,
  Tooltip,
  categoryAxis,
  chartGrid,
  valueAxis,
} from "./chart-parts";

export type MetricSeries = {
  metricName: string;
  points: Array<{ label: string; value: number | null }>;
};

/**
 * One metric followed across periods, with the metric chosen by the reader.
 *
 * Only metrics that appear in at least two periods are offered — a single
 * reading is a number, not a trend.
 */
export default function MetricTrendChart({
  locale,
  series,
}: {
  locale: Locale;
  series: MetricSeries[];
}) {
  const t = useTranslations("portal.charts");
  const tMetrics = useTranslations("metrics");

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

  const picker =
    available.length > 1 ? (
      <div className="scrollbar-slim -mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-1">
        {available.map((entry) => (
          <button
            key={entry.metricName}
            type="button"
            onClick={() => setSelected(entry.metricName)}
            aria-pressed={entry.metricName === active?.metricName}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors",
              entry.metricName === active?.metricName
                ? "border-white/20 bg-white/[0.09] text-white"
                : "border-white/10 text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
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
    >
      <AreaChart data={active?.points ?? []} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="metric-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.views} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART_COLORS.views} stopOpacity={0} />
          </linearGradient>
        </defs>
        {chartGrid()}
        {categoryAxis(locale)}
        {valueAxis(locale)}
        <Tooltip content={<ChartTooltip locale={locale} />} />
        <Area
          type="monotone"
          dataKey="value"
          name={active ? labelFor(active.metricName) : ""}
          stroke={CHART_COLORS.views}
          strokeWidth={2}
          fill="url(#metric-trend-fill)"
          dot={{ r: 2.5, strokeWidth: 0, fill: CHART_COLORS.views }}
          activeDot={{ r: 4 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartFrame>
  );
}
