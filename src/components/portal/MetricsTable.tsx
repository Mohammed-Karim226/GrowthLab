"use client";

import { useTranslations } from "next-intl";

import GrowthBadge from "@/components/portal/GrowthBadge";
import { formatMetricValue, humanizeMetricName } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { MetricComparison } from "@/lib/analytics/comparisons";
import { PLATFORMS } from "@/types/database";

export default function MetricsTable({ locale, metrics }: { locale: Locale; metrics: MetricComparison[] }) {
  const t = useTranslations("portal.detail");
  const tUi = useTranslations("portal.ui");
  const tPlatforms = useTranslations("platforms");
  const tMetrics = useTranslations("metrics");

  const grouped = PLATFORMS.map((platform) => ({
    platform,
    rows: metrics.filter((metric) => metric.platform === platform),
  })).filter((group) => group.rows.length > 0);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold tracking-[0.2em] text-[#6f6e68] uppercase">{tUi("dataLedger")}</p>
          <h2 className="mt-1 font-satoshi text-xl tracking-[-0.03em] text-[#f2efe7]">{t("metricsTitle")}</h2>
        </div>
        <p className="max-w-xl text-end text-[11px] leading-relaxed text-[#77766f]">{t("metricsHint")}</p>
      </div>

      {grouped.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/[0.08] bg-black/10 px-4 py-10 text-center text-sm text-[#77766f]">{t("metricsEmpty")}</p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {grouped.map((group) => (
            <article key={group.platform} className="overflow-hidden rounded-[24px] border border-white/[0.065] bg-[#0e0f0c] shadow-[0_20px_55px_rgba(0,0,0,0.16)]">
              <div className="flex items-center gap-3 border-b border-white/[0.055] bg-white/[0.018] px-5 py-4">
                <span className="flex size-8 items-center justify-center rounded-xl border border-[#d8be78]/15 bg-[#d8be78]/[0.07]">
                  <span className="size-1.5 rounded-full bg-[#d8be78] shadow-[0_0_10px_rgba(216,190,120,0.6)]" />
                </span>
                <h3 className="text-[11px] font-semibold tracking-[0.12em] text-[#aaa69d] uppercase">{tPlatforms(group.platform)}</h3>
                <span className="ms-auto rounded-full border border-white/[0.06] bg-white/[0.025] px-2.5 py-1 text-[9px] tabular-nums text-[#77766f]">{group.rows.length}</span>
              </div>

              <dl className="divide-y divide-white/[0.045]">
                {group.rows.map((row) => {
                  const label = tMetrics.has(row.metricName as never) ? tMetrics(row.metricName as never) : humanizeMetricName(row.metricName);
                  return (
                    <div key={`${row.platform}:${row.metricName}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-white/[0.018]">
                      <dt className="min-w-0 text-xs font-medium text-[#aaa79e]">{label}</dt>
                      <dd className="text-end font-satoshi text-lg tracking-[-0.03em] tabular-nums text-[#f0ede5]">
                        {row.current === null ? t("notReported") : formatMetricValue(row.current, row.unit, locale)}
                      </dd>
                      <div className="text-[9px] tracking-wide text-[#5f5e58] uppercase">
                        {t("previous")}: <span className="tabular-nums text-[#77766f]">{row.previous === null ? t("notReported") : formatMetricValue(row.previous, row.unit, locale)}</span>
                      </div>
                      <div className="justify-self-end"><GrowthBadge locale={locale} growth={row.growth} /></div>
                    </div>
                  );
                })}
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
