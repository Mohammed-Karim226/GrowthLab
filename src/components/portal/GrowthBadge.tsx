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
          "inline-flex items-center gap-1 rounded-full border border-[#d8be78]/15 bg-[#d8be78]/[0.055] px-2 py-0.5 text-[10px] font-medium text-[#d8c58e]",
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
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold tabular-nums",
        growth.direction === "up" && "border-[#54d8ac]/10 bg-[#54d8ac]/[0.07] text-[#68dcb7]",
        growth.direction === "down" && "border-[#ed8f6d]/10 bg-[#ed8f6d]/[0.07] text-[#ef9a7a]",
        growth.direction === "flat" && "border-white/[0.06] bg-white/[0.035] text-[#8a8880]",
        className
      )}
    >
      <Icon className="size-3 rtl:rotate-180" aria-hidden />
      {formatSignedPercent(growth.percent, locale)}
    </span>
  );
}
