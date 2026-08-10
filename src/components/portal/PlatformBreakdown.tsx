"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import GrowthBadge from "@/components/portal/GrowthBadge";
import { formatMetricValue, formatNumber, humanizeMetricName } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { MetricComparison, PlatformComparison } from "@/lib/analytics/comparisons";
import type { Platform } from "@/types/database";

const ACCENT: Record<Platform, string> = {
  facebook: "bg-[#4c7dff]",
  instagram: "bg-[#e1568f]",
  tiktok: "bg-[#38d6c8]",
  youtube: "bg-[#ef5c5c]",
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

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="font-satoshi text-base text-white">{t("title")}</h2>
        <p className="text-xs text-slate-400">{t("hint")}</p>
      </div>

      {platforms.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">
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
  const tKpi = useTranslations("portal.kpi");
  const tPlatforms = useTranslations("platforms");
  const tMetrics = useTranslations("metrics");
  const [open, setOpen] = useState(false);

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
    <article className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-3.5">
        <span
          aria-hidden
          className={cn("size-2.5 shrink-0 rounded-full", ACCENT[comparison.platform])}
        />
        <h3 className="font-satoshi text-sm text-white">{tPlatforms(comparison.platform)}</h3>
        <span className="ms-auto text-xs text-slate-500">
          {t("metricsCount", { count: metrics.length })}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-4 px-5 py-4">
        {headline.map((entry) => (
          <div key={entry.key} className="space-y-1">
            <dt className="text-xs text-slate-500">{tKpi(entry.key as never)}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {entry.value === null ? (
                // A dash reads as nothing at all to a screen reader, so the
                // words go with it. Still not a zero (plan §16).
                <span className="text-slate-500" aria-label={tKpi("missing")}>
                  —
                </span>
              ) : (
                <span className="tabular-nums text-slate-100">
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
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-2 border-t border-white/[0.06] px-5 py-2.5 text-xs text-slate-400 transition-colors hover:text-slate-200"
          >
            {open ? t("hideMetrics") : t("showMetrics")}
            <ChevronDown
              className={cn("size-3.5 transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </button>

          {open && (
            <ul className="divide-y divide-white/[0.05] border-t border-white/[0.06]">
              {metrics.map((metric) => {
                const label = tMetrics.has(metric.metricName as never)
                  ? tMetrics(metric.metricName as never)
                  : humanizeMetricName(metric.metricName);

                return (
                  <li
                    key={`${metric.platform}:${metric.metricName}`}
                    className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                  >
                    <span className="min-w-0 truncate text-slate-400">{label}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums text-slate-100">
                        {formatMetricValue(metric.current, metric.unit, locale)}
                      </span>
                      <GrowthBadge locale={locale} growth={metric.growth} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </article>
  );
}
