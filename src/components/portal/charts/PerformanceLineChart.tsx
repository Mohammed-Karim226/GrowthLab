"use client";

import { Area, AreaChart } from "recharts";
import { useTranslations } from "next-intl";

import type { Locale } from "@/lib/i18n";
import type { TrendPoint } from "@/lib/analytics/comparisons";
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

type Series = keyof typeof CHART_COLORS;
const SERIES: Series[] = ["views", "reach", "engagement", "followers"];

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
      action={active.length > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
          {active.map((series) => (
            <span key={series} className="inline-flex items-center gap-1.5 text-[10px] text-[#77766f]">
              <span className="size-1.5 rounded-full" style={{ backgroundColor: CHART_COLORS[series] }} />
              {t(`series.${series}` as never)}
            </span>
          ))}
        </div>
      ) : undefined}
      isEmpty={points.length < 2 || active.length === 0}
      emptyLabel={t("trendEmpty")}
    >
      <AreaChart data={points} margin={{ top: 12, right: 8, bottom: 0, left: 8 }}>
        <defs>
          {active.map((series) => chartGradient(`performance-${series}`, CHART_COLORS[series], series === "views" ? 0.22 : 0.1))}
          <filter id="performance-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={CHART_COLORS.views} floodOpacity="0.28" />
          </filter>
        </defs>
        {chartGrid()}
        {categoryAxis(locale)}
        {valueAxis(locale)}
        <Tooltip content={<ChartTooltip locale={locale} />} />
        {active.map((series) => (
          <Area
            key={series}
            type="monotone"
            dataKey={series}
            name={t(`series.${series}` as never)}
            stroke={CHART_COLORS[series]}
            strokeWidth={series === "views" ? 2.8 : 1.9}
            fill={`url(#performance-${series})`}
            fillOpacity={1}
            filter={series === "views" ? "url(#performance-glow)" : undefined}
            dot={{ r: 2.2, strokeWidth: 2, stroke: "#11120f", fill: CHART_COLORS[series] }}
            activeDot={{ r: 5, strokeWidth: 3, stroke: "#11120f" }}
            connectNulls={false}
            isAnimationActive
            animationDuration={1050}
            animationEasing="ease-out"
          />
        ))}
      </AreaChart>
    </ChartFrame>
  );
}
