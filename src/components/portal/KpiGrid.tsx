"use client";

import { Eye, Heart, TrendingUp, UserPlus, Users, Waves } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent } from "@/components/ui/card";
import GrowthBadge from "@/components/portal/GrowthBadge";
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

/**
 * The headline row.
 *
 * A KPI nobody reported shows "not captured", never 0 — the difference between
 * "no reach" and "reach not shown on the screenshot" matters to a client
 * reading their own numbers (plan §16).
 */
export default function KpiGrid({
  locale,
  comparison,
}: {
  locale: Locale;
  comparison: PeriodComparison;
}) {
  const t = useTranslations("portal.kpi");

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
      icon: Waves,
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

  return (
    <section className="space-y-3">
      <h2 className="font-satoshi text-base text-white">{t("title")}</h2>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.key} className="liquid-card border-white/[0.06] bg-white/[0.02]">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    {t(card.key as never)}
                  </p>
                  <span className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400">
                    <Icon className="size-4" aria-hidden />
                  </span>
                </div>

                {card.present ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-satoshi text-2xl tabular-nums text-white">{card.value}</p>
                    <GrowthBadge locale={locale} growth={card.growth} />
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{t("missing")}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
