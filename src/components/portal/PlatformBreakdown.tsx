"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { faFacebook, faInstagram, faTiktok, faYoutube } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import GrowthBadge from "@/components/portal/GrowthBadge";
import { formatMetricValue, formatNumber, humanizeMetricName } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { MetricComparison, PlatformComparison } from "@/lib/analytics/comparisons";
import type { Platform } from "@/types/database";

const PLATFORM_STYLE: Record<Platform, { icon: typeof faFacebook; color: string; surface: string }> = {
  facebook: { icon: faFacebook, color: "text-[#6f9cff]", surface: "bg-[#4c7dff]/10" },
  instagram: { icon: faInstagram, color: "text-[#ef7ba8]", surface: "bg-[#e1568f]/10" },
  tiktok: { icon: faTiktok, color: "text-[#62dfd4]", surface: "bg-[#38d6c8]/10" },
  youtube: { icon: faYoutube, color: "text-[#f27676]", surface: "bg-[#ef5c5c]/10" },
};

/**
 * Per-platform totals, with the full metric list one click away.
 *
 * Platforms with nothing readable this period are already filtered out upstream
 * by `platformsPresent`, so an absent platform is simply absent — it is never
 * padded with zeroes to make the four look symmetrical (plan §14).
 */
export default function PlatformBreakdown({
  locale,
  platforms,
  metrics,
}: {
  locale: Locale;
  platforms: PlatformComparison[];
  metrics: MetricComparison[];
}) {
  const t = useTranslations("portal.platforms");
  const tUi = useTranslations("portal.ui");

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[9px] font-semibold tracking-[0.2em] text-[#6f6e68] uppercase">{tUi("channelIntelligence")}</p>
          <h2 className="font-satoshi text-xl tracking-[-0.03em] text-[#f2efe7]">{t("title")}</h2>
        </div>
        <p className="max-w-md text-end text-[11px] text-[#77766f]">{t("hint")}</p>
      </div>

      {platforms.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/[0.08] bg-black/10 px-4 py-10 text-center text-sm text-[#77766f]">
          {t("empty")}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {platforms.map((platform) => (
            <PlatformCard
              key={platform.platform}
              locale={locale}
              comparison={platform}
              metrics={metrics.filter((metric) => metric.platform === platform.platform)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PlatformCard({
  locale,
  comparison,
  metrics,
}: {
  locale: Locale;
  comparison: PlatformComparison;
  metrics: MetricComparison[];
}) {
  const t = useTranslations("portal.platforms");
  const tUi = useTranslations("portal.ui");
  const tKpi = useTranslations("portal.kpi");
  const tPlatforms = useTranslations("platforms");
  const tMetrics = useTranslations("metrics");
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const style = PLATFORM_STYLE[comparison.platform];

  const headline = [
    { key: "totalViews", value: comparison.current.views, growth: comparison.viewsGrowth },
    { key: "totalReach", value: comparison.current.reach, growth: null },
    {
      key: "totalEngagement",
      value: comparison.current.engagement,
      growth: comparison.engagementGrowth,
    },
    { key: "totalFollowers", value: comparison.current.followers, growth: comparison.followersGrowth },
  ] as const;

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="portal-platform-card group overflow-hidden rounded-[28px] border border-white/[0.13]"
    >
      <div className="flex items-center gap-3 border-b border-white/[0.055] px-5 py-4">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-[17px] border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_12px_30px_rgba(0,0,0,.18)]", style.surface, style.color)}>
          <FontAwesomeIcon icon={style.icon} className="size-[20px]" aria-hidden />
        </span>
        <div>
          <h3 className="font-satoshi text-[15px] tracking-[-0.02em] text-[#f1eee6]">{tPlatforms(comparison.platform)}</h3>
          <p className="mt-0.5 text-[9px] font-medium tracking-[0.12em] text-[#686861] uppercase">{tUi("connectedChannel")}</p>
        </div>
        <span className="ms-auto rounded-full border border-white/[0.06] bg-white/[0.025] px-2.5 py-1 text-[9px] font-medium text-[#77766f]">
          {t("metricsCount", { count: metrics.length })}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-2 bg-transparent p-2.5 sm:p-3">
        {headline.map((entry) => (
          <div key={entry.key} className="min-w-0 space-y-2 rounded-[16px] border border-white/[0.075] bg-white/[0.035] px-3 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] sm:rounded-[18px] sm:px-4 sm:py-4">
            <dt className="text-[9px] font-medium tracking-[0.1em] text-[#696861] uppercase">{tKpi(entry.key as never)}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {entry.value === null ? (
                // A dash reads as nothing at all to a screen reader, so the
                // words go with it. Still not a zero (plan §16).
                <span className="text-[#66655f]" aria-label={tKpi("missing")}>
                  —
                </span>
              ) : (
                <span className="min-w-0 break-words font-satoshi text-base tracking-[-0.03em] tabular-nums text-[#efede6] sm:text-lg">
                  {formatNumber(entry.value, locale)}
                </span>
              )}
              {entry.growth && <GrowthBadge locale={locale} growth={entry.growth} />}
            </dd>
          </div>
        ))}
      </dl>

      {metrics.length > 0 && (
        <>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="h-auto w-full justify-between rounded-none border-t border-white/[0.055] px-5 py-3 text-[10px] font-medium tracking-wide text-[#77766f] hover:bg-white/[0.02] hover:text-[#c9c5ba]"
          >
            {open ? t("hideMetrics") : t("showMetrics")}
            <ChevronDown
              className={cn("size-3.5 transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </Button>

          <AnimatePresence initial={false}>
          {open && (
            <motion.ul
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="divide-y divide-white/[0.045] overflow-hidden border-t border-white/[0.055]"
            >
              {metrics.map((metric) => {
                const label = tMetrics.has(metric.metricName as never)
                  ? tMetrics(metric.metricName as never)
                  : humanizeMetricName(metric.metricName);

                return (
                  <li
                    key={`${metric.platform}:${metric.metricName}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <span className="min-w-0 truncate text-[#8a8880]">{label}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums text-[#e7e3da]">
                        {formatMetricValue(metric.current, metric.unit, locale)}
                      </span>
                      <GrowthBadge locale={locale} growth={metric.growth} />
                    </span>
                  </li>
                );
              })}
            </motion.ul>
          )}
          </AnimatePresence>
        </>
      )}
    </motion.article>
  );
}
