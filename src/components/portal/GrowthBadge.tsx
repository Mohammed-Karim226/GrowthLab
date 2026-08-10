"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { formatSignedPercent } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { GrowthResult } from "@/lib/analytics/calculations";

/**
 * Period-over-period change for a single number.
 *
 * Renders nothing when the comparison is unknown — an absent previous value is
 * not a 0% change (plan §16). A previous value of exactly 0 has no defined
 * percentage, so it reads "new this period" instead of an infinite gain.
 */
export default function GrowthBadge({
  locale,
  growth,
  className,
}: {
  locale: Locale;
  growth: GrowthResult;
  className?: string;
}) {
  const t = useTranslations("portal.overview");

  if (growth.direction === "unknown") return null;

  if (growth.fromZero) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-xs text-slate-300",
          className
        )}
      >
        {t("newMetric")}
      </span>
    );
  }

  const Icon =
    growth.direction === "up" ? ArrowUpRight : growth.direction === "down" ? ArrowDownRight : Minus;

  return (
    <span
      dir="ltr"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs tabular-nums",
        growth.direction === "up" && "bg-emerald-500/10 text-emerald-300",
        growth.direction === "down" && "bg-rose-500/10 text-rose-300",
        growth.direction === "flat" && "bg-white/[0.06] text-slate-300",
        className
      )}
    >
      <Icon className="size-3 rtl:rotate-180" aria-hidden />
      {formatSignedPercent(growth.percent, locale)}
    </span>
  );
}
