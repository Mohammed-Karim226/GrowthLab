"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Eye, Heart, RadioTower, TrendingUp, UserPlus, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import GrowthBadge from "@/components/portal/GrowthBadge";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { PeriodComparison } from "@/lib/analytics/comparisons";
import type { GrowthResult } from "@/lib/analytics/calculations";

const UNKNOWN: GrowthResult = {
  percent: null,
  absolute: null,
  direction: "unknown",
  fromZero: false,
};

const ACCENTS = [
  { text: "text-[#e2c87e]", bg: "bg-[#d8be78]/10", line: "from-[#d8be78]" },
  { text: "text-[#69ddb8]", bg: "bg-[#54d8ac]/10", line: "from-[#54d8ac]" },
  { text: "text-[#f19b77]", bg: "bg-[#ed8f6d]/10", line: "from-[#ed8f6d]" },
  { text: "text-[#a9a4ff]", bg: "bg-[#8d87f5]/10", line: "from-[#8d87f5]" },
  { text: "text-[#7fd1ed]", bg: "bg-[#68c5e5]/10", line: "from-[#68c5e5]" },
  { text: "text-[#e9b7d1]", bg: "bg-[#d993b7]/10", line: "from-[#d993b7]" },
] as const;

export default function KpiGrid({
  locale,
  comparison,
  compact = false,
}: {
  locale: Locale;
  comparison: PeriodComparison;
  compact?: boolean;
}) {
  const t = useTranslations("portal.kpi");
  const tUi = useTranslations("portal.ui");
  const reduceMotion = useReducedMotion();

  const cards = [
    {
      key: "totalViews",
      icon: Eye,
      value: formatNumber(comparison.current.totalViews, locale),
      present: comparison.current.totalViews !== null,
      growth: comparison.kpiGrowth.totalViews,
    },
    {
      key: "totalReach",
      icon: RadioTower,
      value: formatNumber(comparison.current.totalReach, locale),
      present: comparison.current.totalReach !== null,
      growth: comparison.kpiGrowth.totalReach,
    },
    {
      key: "totalEngagement",
      icon: Heart,
      value: formatNumber(comparison.current.totalEngagement, locale),
      present: comparison.current.totalEngagement !== null,
      growth: comparison.kpiGrowth.totalEngagement,
    },
    {
      key: "totalFollowers",
      icon: Users,
      value: formatNumber(comparison.current.totalFollowers, locale),
      present: comparison.current.totalFollowers !== null,
      growth: comparison.kpiGrowth.totalFollowers,
    },
    {
      key: "followerGrowth",
      icon: UserPlus,
      value: formatNumber(comparison.current.followerGrowth, locale),
      present: comparison.current.followerGrowth !== null,
      growth: UNKNOWN,
    },
    {
      key: "engagementRate",
      icon: TrendingUp,
      value: formatPercent(comparison.current.engagementRate, locale),
      present: comparison.current.engagementRate !== null,
      growth: comparison.kpiGrowth.engagementRate,
    },
  ] as const;
  const visibleCards = compact ? cards.filter((card) => card.key !== "followerGrowth") : cards;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold tracking-[0.2em] text-[#6f6e68] uppercase">
            {tUi("performancePulse")}
          </p>
          <h2 className="mt-1 font-satoshi text-xl tracking-[-0.03em] text-[#f2efe7]">
            {t("title")}
          </h2>
        </div>
        <span className="hidden h-px flex-1 bg-gradient-to-r from-white/[0.07] to-transparent sm:block" />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {visibleCards.map((card, index) => {
          const Icon = card.icon;
          const accent = ACCENTS[index];
          const featured = !compact && index < 2;

          return (
            <motion.article
              key={card.key}
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.5, delay: index * 0.055, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "portal-metric-card group relative min-w-0 overflow-hidden rounded-[22px] border border-white/[0.13] p-4 sm:rounded-[28px] sm:p-6",
                compact ? "min-h-[132px] sm:min-h-[150px]" : "min-h-[150px] sm:min-h-[168px]",
                featured && "xl:col-span-2 xl:min-h-[184px]"
              )}
            >
              <div
                aria-hidden
                className={cn(
                  "absolute inset-x-0 top-0 h-px bg-gradient-to-r via-transparent to-transparent opacity-70",
                  accent.line
                )}
              />
              <div
                aria-hidden
                className={cn(
                  "absolute -top-12 -end-10 size-36 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-35",
                  accent.bg
                )}
              />
              <div aria-hidden className="portal-orbit absolute -end-10 -bottom-14 size-40 rounded-full border border-white/[0.035]" />

              <div className="relative flex h-full flex-col justify-between gap-5 sm:gap-7">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.13em] text-[#7d7b74] uppercase">
                      {t(card.key as never)}
                    </p>
                    <span className="mt-2 block h-px w-7 bg-white/[0.09]" />
                  </div>
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-[15px] border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_12px_28px_rgba(0,0,0,.2)] transition-transform duration-300 group-hover:scale-105 sm:size-12 sm:rounded-[17px]", accent.bg, accent.text)}>
                    <Icon className="size-[17px] sm:size-[20px]" strokeWidth={1.65} aria-hidden />
                  </span>
                </div>

                {card.present ? (
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <p
                      className={cn(
                        "font-satoshi leading-none tracking-[-0.055em] tabular-nums text-[#f7f4ed]",
                        featured ? "text-[28px] sm:text-[46px]" : compact ? "text-[24px] sm:text-[31px]" : "text-[25px] sm:text-[34px]"
                      )}
                    >
                      {card.value}
                    </p>
                    <GrowthBadge locale={locale} growth={card.growth} />
                  </div>
                ) : (
                  <p className="text-sm text-[#6f6e68]">{t("missing")}</p>
                )}
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
