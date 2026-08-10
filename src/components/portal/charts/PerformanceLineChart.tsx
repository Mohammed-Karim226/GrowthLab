"use client";

import { Line, LineChart } from "recharts";
import { useTranslations } from "next-intl";

import type { Locale } from "@/lib/i18n";
import type { TrendPoint } from "@/lib/analytics/comparisons";
import {
  CHART_COLORS,
  ChartFrame,
  ChartTooltip,
  Tooltip,
  categoryAxis,
  chartGrid,
  valueAxis,
} from "./chart-parts";

type Series = keyof typeof CHART_COLORS;

const SERIES: Series[] = ["views", "reach", "engagement", "followers"];

/**
 * Totals across every platform, one point per published period.
 *
 * Needs at least two points to say anything about a trend, so a single period
 * renders the empty state instead of a one-dot line. `connectNulls` is off:
 * a period that never reported a metric leaves a gap rather than a straight
 * line implying continuity (plan §16).
 */
export default function PerformanceLineChart({
  locale,
  points,
}: {
  locale: Locale;
  points: TrendPoint[];
}) {
  const t = useTranslations("portal.charts");

  const active = SERIES.filter((series) =>
    points.some((point) => point[series] !== null && point[series] !== undefined)
  );

  return (
    <ChartFrame
      title={t("trendTitle")}
      hint={t("trendHint")}
      isEmpty={points.length < 2 || active.length === 0}
      emptyLabel={t("trendEmpty")}
    >
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        {chartGrid()}
        {categoryAxis(locale)}
        {valueAxis(locale)}
        <Tooltip content={<ChartTooltip locale={locale} />} />
        {active.map((series) => (
          <Line
            key={series}
            type="monotone"
            dataKey={series}
            name={t(`series.${series}` as never)}
            stroke={CHART_COLORS[series]}
            strokeWidth={2}
            dot={{ r: 2.5, strokeWidth: 0, fill: CHART_COLORS[series] }}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartFrame>
  );
}
