"use client";

import { useTranslations } from "next-intl";
import { faFacebook, faInstagram, faTiktok, faYoutube } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import GrowthBadge from "@/components/portal/GrowthBadge";
import { formatMetricValue, humanizeMetricName } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { MetricComparison } from "@/lib/analytics/comparisons";
import { PLATFORMS } from "@/types/database";

const PLATFORM_ICONS = { facebook: faFacebook, instagram: faInstagram, tiktok: faTiktok, youtube: faYoutube };
const PLATFORM_COLOR = { facebook: "#6f9cff", instagram: "#ef7ba8", tiktok: "#62dfd4", youtube: "#f27676" };

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
            <article key={group.platform} className="portal-platform-card overflow-hidden rounded-[28px] border border-white/[0.13] shadow-[0_24px_70px_rgba(0,0,0,0.2)]">
              <div className="flex items-center gap-3 border-b border-white/[0.08] bg-white/[0.035] px-5 py-4">
                <span className="flex size-11 items-center justify-center rounded-[16px] border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_12px_28px_rgba(0,0,0,.18)]" style={{ color: PLATFORM_COLOR[group.platform], backgroundColor: `${PLATFORM_COLOR[group.platform]}16` }}>
                  <FontAwesomeIcon icon={PLATFORM_ICONS[group.platform]} className="size-[18px]" aria-hidden />
                </span>
                <h3 className="text-[11px] font-semibold tracking-[0.12em] text-[#aaa69d] uppercase">{tPlatforms(group.platform)}</h3>
                <span className="ms-auto rounded-full border border-white/[0.06] bg-white/[0.025] px-2.5 py-1 text-[9px] tabular-nums text-[#77766f]">{group.rows.length}</span>
              </div>

              <dl className="divide-y divide-white/[0.045]">
                {group.rows.map((row) => {
                  const label = tMetrics.has(row.metricName as never) ? tMetrics(row.metricName as never) : humanizeMetricName(row.metricName);
                  return (
                    <div key={`${row.platform}:${row.metricName}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-4 transition-colors hover:bg-white/[0.045] sm:gap-x-4 sm:px-5">
                      <dt className="min-w-0 text-xs font-medium text-[#aaa79e]">{label}</dt>
                      <dd className="max-w-[46vw] break-words text-end font-satoshi text-base tracking-[-0.03em] tabular-nums text-[#f0ede5] sm:max-w-none sm:text-lg">
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
