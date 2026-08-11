import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import KpiGrid from "@/components/portal/KpiGrid";
import PlatformBreakdown from "@/components/portal/PlatformBreakdown";
import MetricsTable from "@/components/portal/MetricsTable";
import InsightsPanel from "@/components/portal/InsightsPanel";
import PlatformComparisonChart from "@/components/portal/charts/PlatformComparisonChart";
import { requireClient } from "@/lib/auth";
import { listPublishedPeriods, loadMetrics, loadPublishedPeriod } from "@/lib/portal/data";
import { comparePeriods } from "@/lib/analytics/comparisons";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { formatDate, formatDateRange } from "@/lib/format";
import PortalHero from "@/components/portal/PortalHero";

export const dynamic = "force-dynamic";

/**
 * One published period in full.
 *
 * The report id arrives from the URL, so it is passed to a query that also
 * filters on the session's own client id — an id belonging to another tenant
 * resolves to null and renders a 404, not a permission message that would
 * confirm the report exists (plan §43).
 */
export default async function PortalReportPage({
  params,
}: {
  params: Promise<{ locale: string; reportId: string }>;
}) {
  const { locale: raw, reportId } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;

  const session = await requireClient(locale);
  const [t, tReports] = await Promise.all([
    getTranslations({ locale, namespace: "portal.overview" }),
    getTranslations({ locale, namespace: "portal.reports" }),
  ]);

  const period = await loadPublishedPeriod(reportId, session.clientId);
  if (!period) notFound();

  // The preceding published period supplies the comparison column. It is read
  // from the same tenant-scoped list, so it can never be another client's.
  const history = await listPublishedPeriods(session.clientId);
  const index = history.findIndex((entry) => entry.reportId === period.reportId);
  const previous = index >= 0 ? (history[index + 1] ?? null) : null;

  const versionIds = previous ? [period.versionId, previous.versionId] : [period.versionId];
  const metricsByVersion = await loadMetrics(versionIds);

  const comparison = comparePeriods(
    metricsByVersion.get(period.versionId) ?? [],
    previous ? (metricsByVersion.get(previous.versionId) ?? []) : null
  );

  return (
    <div className="space-y-12">
      <div className="space-y-4">
        <Link
          href={`/${locale}/portal/reports`}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[10px] font-medium text-[#85837b] transition-colors hover:border-[#d8be78]/15 hover:text-[#d8c58e]"
        >
          <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
          {tReports("backToReports")}
        </Link>

        <PortalHero
          compact
          eyebrow={t("latestPeriod")}
          title={period.title}
          period={formatDateRange(period.periodStart, period.periodEnd, locale)}
          publishedLabel={
            period.publishedAt
              ? t("publishedOn", { date: formatDate(period.publishedAt, locale) })
              : t("versionNote", { number: period.versionNumber })
          }
          comparisonLabel={
            previous
              ? t("comparedTo", {
                  period: formatDateRange(previous.periodStart, previous.periodEnd, locale),
                })
              : t("noComparison")
          }
        />
      </div>

      <KpiGrid locale={locale} comparison={comparison} />

      <InsightsPanel summary={period.summary} aiSummary={period.aiSummary} />

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

      <PlatformBreakdown
        locale={locale}
        platforms={comparison.platforms}
        metrics={comparison.metrics}
      />

      <MetricsTable locale={locale} metrics={comparison.metrics} />
    </div>
  );
}
