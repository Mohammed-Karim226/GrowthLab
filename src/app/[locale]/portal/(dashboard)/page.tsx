import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";

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
        <header className="space-y-1.5">
          <h1 className="font-satoshi text-2xl text-white sm:text-3xl">{t("title")}</h1>
          <p className="max-w-xl text-sm text-slate-400">{t("subtitle")}</p>
        </header>

        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
          <p className="text-sm text-slate-300">{t("noReports")}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{t("noReportsHint")}</p>
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
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs tracking-wide text-slate-500 uppercase">{t("latestPeriod")}</p>
          <h1 className="font-satoshi text-2xl text-white sm:text-3xl">{latest.title}</h1>
          <p className="text-sm text-slate-400">
            {formatDateRange(latest.periodStart, latest.periodEnd, locale)}
          </p>
          <p className="text-xs text-slate-500">
            {latest.publishedAt
              ? t("publishedOn", { date: formatDate(latest.publishedAt, locale) })
              : t("versionNote", { number: latest.versionNumber })}
          </p>
          <p className="text-xs text-slate-500">
            {previous
              ? t("comparedTo", {
                  period: formatDateRange(previous.periodStart, previous.periodEnd, locale),
                })
              : t("noComparison")}
          </p>
        </div>

        <Link
          href={`/${locale}/portal/reports/${latest.reportId}`}
          className="button-primary button-shine inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white"
        >
          {t("viewReport")}
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
      </header>

      <KpiGrid locale={locale} comparison={comparison} />

      <div className="grid gap-6 xl:grid-cols-2">
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

      <PlatformBreakdown
        locale={locale}
        platforms={comparison.platforms}
        metrics={comparison.metrics}
      />

      <InsightsPanel summary={latest.summary} aiSummary={latest.aiSummary} />
    </div>
  );
}
