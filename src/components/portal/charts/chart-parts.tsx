"use client";

import type { ReactNode } from "react";
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
  views: "#7c8cff",
  reach: "#43d9c4",
  engagement: "#f6a94a",
  followers: "#c084fc",
} as const;

export const PLATFORM_COLORS: Record<string, string> = {
  facebook: "#4c7dff",
  instagram: "#e1568f",
  tiktok: "#38d6c8",
  youtube: "#ef5c5c",
};

export const AXIS_STYLE = {
  fill: "#94a3b8",
  fontSize: 11,
} as const;

export const GRID_STROKE = "rgba(148, 163, 184, 0.14)";

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
  children,
}: {
  title: string;
  hint: string;
  action?: ReactNode;
  isEmpty: boolean;
  emptyLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-satoshi text-base text-white">{title}</h2>
          <p className="text-xs text-slate-400">{hint}</p>
        </div>
        {action}
      </div>

      {isEmpty ? (
        <p className="mt-6 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">
          {emptyLabel}
        </p>
      ) : (
        // role="img" makes the plot a single leaf node, so a screen reader hears
        // the label instead of crawling every axis tick as loose text. The same
        // figures are available as text in the platform breakdown and the report
        // metrics table.
        <div
          role="img"
          aria-label={`${title}. ${hint}`}
          className="mt-5 h-64 w-full sm:h-72"
        >
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
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
  return <CartesianGrid stroke={GRID_STROKE} vertical={false} />;
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
      className="rounded-xl border border-white/10 bg-[#0b1030]/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
    >
      <p className="mb-1.5 text-slate-300">{label}</p>
      <ul className="space-y-1">
        {rows.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-400">{entry.name}</span>
            <span className="ms-auto tabular-nums text-slate-100">
              {formatCompact(Number(entry.value), locale)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function tooltipCursor() {
  return { fill: "rgba(148, 163, 184, 0.08)" };
}

export { Tooltip };
