import { getTranslations } from "next-intl/server";
import { ChevronDown, FileBarChart, Sparkles } from "lucide-react";

import KpiGrid from "@/components/portal/KpiGrid";
import PlatformBreakdown from "@/components/portal/PlatformBreakdown";
import InsightsPanel from "@/components/portal/InsightsPanel";
import PerformanceLineChart from "@/components/portal/charts/PerformanceLineChart";
import PlatformComparisonChart from "@/components/portal/charts/PlatformComparisonChart";
import MetricTrendChart from "@/components/portal/charts/MetricTrendChart";
import { requireClient } from "@/lib/auth";
import { listPublishedPeriods, loadMetrics } from "@/lib/portal/data";
import { buildMetricSeries } from "@/lib/portal/series";
import { buildTrendSeries, comparePeriods } from "@/lib/analytics/comparisons";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { formatDate, formatDateRange } from "@/lib/format";
import PortalHero from "@/components/portal/PortalHero";
import ReportIntelligenceBrief from "@/components/portal/ReportIntelligenceBrief";

export const dynamic = "force-dynamic";

/**
 * The client's landing page: their latest published period, compared with the
 * one before it, plus history.
 *
 * The tenant id comes from the session, never the URL, and the queries behind
 * `listPublishedPeriods` only ever return published versions (plan §43).
 */
export default async function PortalOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;

  const session = await requireClient(locale);
  const t = await getTranslations({ locale, namespace: "portal.overview" });

  const periods = await listPublishedPeriods(session.clientId);

  if (periods.length === 0) {
    return (
      <div className="space-y-6">
        <header className="portal-hero portal-reveal relative overflow-hidden rounded-[30px] border border-white/[0.07] px-6 py-10 sm:px-10 sm:py-14">
          <div aria-hidden className="portal-hero-grid absolute inset-0 opacity-70" />
          <div className="relative max-w-2xl">
            <span className="mb-6 flex size-12 items-center justify-center rounded-2xl border border-[#d8be78]/15 bg-[#d8be78]/[0.07] text-[#dcc580]">
              <Sparkles className="size-5" strokeWidth={1.7} aria-hidden />
            </span>
            <h1 className="font-satoshi text-3xl tracking-[-0.045em] text-[#f4f0e7] sm:text-5xl">{t("title")}</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#85837b]">{t("subtitle")}</p>
          </div>
        </header>

        <div className="rounded-[28px] border border-dashed border-white/[0.08] bg-black/10 px-6 py-16 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.025] text-[#8d8a82]">
            <FileBarChart className="size-5" strokeWidth={1.7} aria-hidden />
          </span>
          <p className="mt-5 text-sm font-medium text-[#cac6bc]">{t("noReports")}</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[#77766f]">{t("noReportsHint")}</p>
        </div>
      </div>
    );
  }

  const metricsByVersion = await loadMetrics(periods.map((period) => period.versionId));

  const [latest, previous] = periods;
  const latestMetrics = metricsByVersion.get(latest.versionId) ?? [];
  const previousMetrics = previous ? (metricsByVersion.get(previous.versionId) ?? []) : null;

  const comparison = comparePeriods(latestMetrics, previousMetrics);

  // Oldest-first for the charts; `periods` itself is newest-first.
  const chronological = [...periods].reverse().map((period) => ({
    reportId: period.reportId,
    versionId: period.versionId,
    title: period.title,
    periodEnd: period.periodEnd,
    metrics: metricsByVersion.get(period.versionId) ?? [],
  }));

  const trend = buildTrendSeries(chronological);
  const metricSeries = buildMetricSeries(
    chronological.map((period) => ({ label: period.title, metrics: period.metrics }))
  );

  return (
    <div className="space-y-6">
      <PortalHero
        eyebrow={t("latestPeriod")}
        title={latest.title}
        period={formatDateRange(latest.periodStart, latest.periodEnd, locale)}
        publishedLabel={
          latest.publishedAt
            ? t("publishedOn", { date: formatDate(latest.publishedAt, locale) })
            : t("versionNote", { number: latest.versionNumber })
        }
        comparisonLabel={
          previous
            ? t("comparedTo", {
                period: formatDateRange(previous.periodStart, previous.periodEnd, locale),
              })
            : t("noComparison")
        }
        action={{
          href: `/${locale}/portal/reports/${latest.reportId}`,
          label: t("viewReport"),
        }}
      />

      <ReportIntelligenceBrief locale={locale} comparison={comparison} />

      <KpiGrid locale={locale} comparison={comparison} compact />

      <details className="portal-deep-dive group rounded-[28px] border border-white/[0.1] bg-white/[0.02] p-3 sm:p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[20px] px-3 py-3 text-sm font-medium text-[#d9d5ca] transition-colors hover:bg-white/[0.045] [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-[10px] font-semibold tracking-[0.18em] text-[#d8be78] uppercase">{t("deepDiveEyebrow")}</span>
            <span className="mt-1 block text-xs text-[#85837b]">{t("deepDiveHint")}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-[#bca66e] transition-transform group-open:rotate-180" aria-hidden />
        </summary>

        <div className="mt-4 space-y-6 border-t border-white/[0.07] px-1 pt-5 sm:px-2">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <PerformanceLineChart locale={locale} points={trend} />
            <PlatformComparisonChart
              locale={locale}
              platforms={comparison.platforms.map((platform) => ({
                platform: platform.platform,
                views: platform.current.views,
                reach: platform.current.reach,
                engagement: platform.current.engagement,
                followers: platform.current.followers,
              }))}
            />
          </div>

          {metricSeries.length > 0 && <MetricTrendChart locale={locale} series={metricSeries} />}

          <PlatformBreakdown locale={locale} platforms={comparison.platforms} metrics={comparison.metrics} />
          <InsightsPanel summary={latest.summary} aiSummary={latest.aiSummary} />
        </div>
      </details>
    </div>
  );
}
