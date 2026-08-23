"use client";

import { useState } from "react";
import { Area, AreaChart, Line, ReferenceLine, ResponsiveContainer } from "recharts";
import { Eye, Heart, RadioTower, Users, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatCompact } from "@/lib/format";
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
const SERIES: Array<{ key: Series; icon: LucideIcon }> = [
  { key: "views", icon: Eye },
  { key: "reach", icon: RadioTower },
  { key: "engagement", icon: Heart },
  { key: "followers", icon: Users },
];

export default function PerformanceLineChart({ locale, points }: { locale: Locale; points: TrendPoint[] }) {
  const t = useTranslations("portal.charts");
  const available = SERIES.filter(({ key }) => points.some((point) => point[key] !== null));
  const [selected, setSelected] = useState<Series>(available[0]?.key ?? "views");
  const active = available.some(({ key }) => key === selected) ? selected : available[0]?.key ?? "views";
  const values = points.flatMap((point) => point[active] === null ? [] : [Number(point[active])]);
  const current = values.at(-1) ?? null;
  const previous = values.at(-2) ?? null;
  const change = current !== null && previous !== null && previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : null;
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const color = CHART_COLORS[active];

  return (
    <ChartFrame title={t("trendTitle")} hint={t("trendHint")} isEmpty={points.length < 2 || available.length === 0} emptyLabel={t("trendEmpty")} responsive={false}>
      <div className="grid min-h-0 gap-3 sm:gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1 lg:content-start">
          {available.map(({ key, icon: Icon }) => {
            const value = points.at(-1)?.[key] ?? null;
            const selectedMetric = key === active;
            return (
              <Button key={key} type="button" variant="outline" onClick={() => setSelected(key)} aria-pressed={selectedMetric} className={cn(
                "group h-auto min-w-0 justify-start gap-2.5 p-2.5 text-start whitespace-normal sm:gap-3 sm:p-3",
                selectedMetric ? "border-white/[0.12] bg-white/[0.07] shadow-[0_16px_35px_rgba(0,0,0,0.2)]" : "border-white/[0.05] bg-white/[0.018] hover:bg-white/[0.04]"
              )}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[13px]" style={{ color, backgroundColor: `${color}16`, boxShadow: selectedMetric ? `0 0 28px ${color}20` : undefined }}>
                  <Icon className="size-4" strokeWidth={1.8} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[9px] font-semibold tracking-[0.1em] text-[#77766f] uppercase">{t(`series.${key}` as never)}</span>
                  <span className="mt-1 block font-satoshi text-base tabular-nums text-[#f0ede5]">{formatCompact(value, locale)}</span>
                </span>
              </Button>
            );
          })}
        </div>

        <div className="relative h-[250px] min-w-0 overflow-hidden rounded-[18px] border border-white/[0.05] bg-[#090a08]/50 sm:h-[280px] sm:rounded-[20px]">
          <div className="absolute start-4 top-4 z-10 sm:start-5 sm:top-5">
            <p className="text-[9px] font-semibold tracking-[0.16em] text-[#696861] uppercase">{t(`series.${active}` as never)}</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="font-satoshi text-3xl tracking-[-0.05em] tabular-nums text-[#f5f1e8]">{formatCompact(current, locale)}</span>
              {change !== null && <span className={cn("mb-1 rounded-full px-2 py-1 text-[9px] font-semibold tabular-nums", change >= 0 ? "bg-[#54d8ac]/10 text-[#69ddb8]" : "bg-[#ed8f6d]/10 text-[#ef9b7b]")}>{change > 0 ? "+" : ""}{change.toFixed(1)}%</span>}
            </div>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 78, right: 18, bottom: 4, left: 8 }}>
              <defs>
                {chartGradient("performance-focus", color, 0.42)}
                <filter id="performance-focus-glow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={color} floodOpacity="0.42" /></filter>
              </defs>
              {chartGrid()}{categoryAxis(locale)}{valueAxis(locale)}
              {average !== null && <ReferenceLine y={average} stroke="rgba(255,255,255,0.13)" strokeDasharray="4 7" />}
              <Tooltip content={<ChartTooltip locale={locale} />} />
              <Area type="monotone" dataKey={active} name={t(`series.${active}` as never)} stroke="transparent" fill="url(#performance-focus)" connectNulls={false} animationDuration={750} />
              <Line type="monotone" dataKey={active} name={t(`series.${active}` as never)} stroke={color} strokeWidth={3.5} dot={{ r: 3, fill: color, stroke: "#0b0c09", strokeWidth: 2 }} activeDot={{ r: 6, fill: color, stroke: "#0b0c09", strokeWidth: 3 }} filter="url(#performance-focus-glow)" connectNulls={false} animationDuration={950} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartFrame>
  );
}
