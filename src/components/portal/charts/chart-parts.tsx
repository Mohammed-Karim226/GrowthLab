"use client";

import type { ReactNode } from "react";
import { Activity } from "lucide-react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import { formatCompact } from "@/lib/format";
import { directionOf, type Locale } from "@/lib/i18n";

/**
 * Shared chart chrome.
 *
 * Recharts renders left-to-right regardless of `dir`, so RTL is handled here by
 * reversing the category axis and flipping the value axis — the data layer keeps
 * its natural oldest-first order (see analytics/comparisons.ts).
 */

export const CHART_COLORS = {
  views: "#dec378",
  reach: "#55dcb1",
  engagement: "#ef9371",
  followers: "#9f99f4",
} as const;

export const PLATFORM_COLORS: Record<string, string> = {
  facebook: "#4c7dff",
  instagram: "#e1568f",
  tiktok: "#38d6c8",
  youtube: "#ef5c5c",
};

export const AXIS_STYLE = {
  fill: "#77766f",
  fontSize: 11,
} as const;

export const GRID_STROKE = "rgba(255, 255, 255, 0.065)";

export function isRtl(locale: Locale) {
  return directionOf(locale) === "rtl";
}

/** Card wrapper so every chart shares one heading, hint and empty state. */
export function ChartFrame({
  title,
  hint,
  action,
  isEmpty,
  emptyLabel,
  responsive = true,
  children,
}: {
  title: string;
  hint: string;
  action?: ReactNode;
  isEmpty: boolean;
  emptyLabel: string;
  responsive?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="portal-chart-card portal-reveal group relative overflow-hidden rounded-[28px] border border-white/[0.075] p-4 sm:p-6">
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d8be78]/35 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -top-24 -end-20 size-56 rounded-full bg-[#d8be78]/[0.035] blur-[80px]" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[14px] border border-[#d8be78]/15 bg-[#d8be78]/[0.07] text-[#d9bf77] shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
            <Activity className="size-4" strokeWidth={1.7} aria-hidden />
          </span>
          <div className="space-y-1">
            <h2 className="font-satoshi text-xl tracking-[-0.035em] text-[#f4f1e9]">{title}</h2>
            <p className="max-w-lg text-[11px] leading-relaxed text-[#77766f]">{hint}</p>
          </div>
        </div>
        {action}
      </div>

      {isEmpty ? (
        <p className="mt-6 rounded-2xl border border-dashed border-white/[0.08] bg-black/10 px-4 py-10 text-center text-sm text-[#77766f]">
          {emptyLabel}
        </p>
      ) : (
        // role="img" makes the plot a single leaf node, so a screen reader hears
        // the label instead of crawling every axis tick as loose text. The same
        // figures are available as text in the platform breakdown and the report
        // metrics table.
        <div
          role={responsive ? "img" : undefined}
          aria-label={responsive ? `${title}. ${hint}` : undefined}
          className="portal-chart-plot relative mt-6 h-72 w-full overflow-hidden rounded-[22px] border border-white/[0.055] bg-black/15 p-2 sm:h-80 sm:p-3"
        >
          {responsive ? (
            <ResponsiveContainer width="100%" height="100%">
              {children as React.ReactElement}
            </ResponsiveContainer>
          ) : children}
        </div>
      )}
    </section>
  );
}

export function categoryAxis(locale: Locale) {
  return (
    <XAxis
      dataKey="label"
      reversed={isRtl(locale)}
      tick={AXIS_STYLE}
      tickLine={false}
      axisLine={{ stroke: GRID_STROKE }}
      interval="preserveStartEnd"
      minTickGap={12}
    />
  );
}

export function valueAxis(locale: Locale) {
  return (
    <YAxis
      orientation={isRtl(locale) ? "right" : "left"}
      tick={AXIS_STYLE}
      tickLine={false}
      axisLine={false}
      width={52}
      tickFormatter={(value: number) => formatCompact(value, locale)}
    />
  );
}

export function chartGrid() {
  return <CartesianGrid stroke={GRID_STROKE} vertical={false} strokeDasharray="3 8" />;
}

export function chartGradient(id: string, color: string, opacity = 0.24) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={opacity} />
      <stop offset="68%" stopColor={color} stopOpacity={opacity * 0.25} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  );
}

type Payload = NonNullable<TooltipProps<number, string>["payload"]>;

/**
 * Tooltip that keeps missing values missing.
 *
 * A metric nobody reported is dropped from the tooltip rather than shown as 0
 * (plan §16).
 */
export function ChartTooltip({
  locale,
  active,
  label,
  payload,
}: {
  locale: Locale;
} & TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  const rows = (payload as Payload).filter(
    (entry) => entry.value !== null && entry.value !== undefined
  );

  if (rows.length === 0) return null;

  return (
    <div
      dir={directionOf(locale)}
      className="rounded-2xl border border-white/[0.09] bg-[#11120f]/95 px-3.5 py-3 text-xs shadow-[0_18px_50px_rgba(0,0,0,0.38)] backdrop-blur-xl"
    >
      <p className="mb-2 font-medium text-[#ddd9ce]">{label}</p>
      <ul className="space-y-1">
        {rows.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-[#85837c]">{entry.name}</span>
            <span className="ms-auto tabular-nums text-[#f2efe8]">
              {formatCompact(Number(entry.value), locale)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function tooltipCursor() {
  return { fill: "rgba(216, 190, 120, 0.055)" };
}

export { Tooltip };
