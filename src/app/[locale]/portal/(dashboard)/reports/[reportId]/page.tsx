import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, BarChart3, BookOpenText, ChartNoAxesCombined, Crown, ListTree, Sparkles } from "lucide-react";

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
import ReportIntelligenceBrief from "@/components/portal/ReportIntelligenceBrief";

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
    <div className="portal-report-detail min-w-0 space-y-9 sm:space-y-12">
      <div className="space-y-4">
        <Link
          href={`/${locale}/portal/reports`}
          className="portal-glass-chip inline-flex items-center gap-2 rounded-full border border-white/[0.13] px-3.5 py-2 text-[10px] font-medium text-[#b8bdcc] transition-all hover:-translate-y-0.5 hover:border-white/25 hover:text-white"
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

      <nav aria-label={tReports("reportNavigation")} className="portal-report-nav portal-glass-panel sticky top-[76px] z-20 flex max-w-full gap-1.5 overflow-x-auto rounded-[20px] border border-white/[0.14] p-1.5 sm:top-20 sm:gap-2 sm:rounded-[24px] sm:p-2">
        {[
          { href: "#overview", label: tReports("overviewSection"), icon: ChartNoAxesCombined },
          { href: "#insights", label: tReports("insightsSection"), icon: BookOpenText },
          { href: "#channels", label: tReports("channelsSection"), icon: BarChart3 },
          { href: "#details", label: tReports("detailsSection"), icon: ListTree },
        ].map(({ href, label, icon: Icon }) => (
          <a key={href} href={href} className="group inline-flex shrink-0 items-center gap-2 rounded-[15px] border border-transparent px-2.5 py-2 text-[9px] font-medium text-[#8f96a9] transition-all hover:border-white/[0.1] hover:bg-white/[0.075] hover:text-white sm:gap-2.5 sm:rounded-[17px] sm:px-3 sm:py-2.5 sm:text-[10px]">
            <span className="flex size-7 items-center justify-center rounded-[10px] border border-white/[0.09] bg-white/[0.055] text-[#d8c27d] shadow-[inset_0_1px_0_rgba(255,255,255,.15)] transition-transform group-hover:scale-105 sm:size-8 sm:rounded-xl"><Icon className="size-3" strokeWidth={1.8} aria-hidden /></span><span>{label}</span>
          </a>
        ))}
        <span className="ms-auto hidden items-center gap-2 px-3 text-[9px] font-semibold tracking-[0.16em] text-[#d9c37e] uppercase xl:flex"><Crown className="size-3.5" aria-hidden />VIP</span>
      </nav>

      <ReportIntelligenceBrief locale={locale} comparison={comparison} />

      <div id="overview" className="portal-report-section scroll-mt-28"><KpiGrid locale={locale} comparison={comparison} /></div>
      <div id="insights" className="portal-report-section scroll-mt-28"><InsightsPanel summary={period.summary} aiSummary={period.aiSummary} /></div>
      <div id="channels" className="portal-report-section scroll-mt-28 space-y-10">
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
        <PlatformBreakdown locale={locale} platforms={comparison.platforms} metrics={comparison.metrics} />
      </div>
      <div id="details" className="portal-report-section scroll-mt-28"><MetricsTable locale={locale} metrics={comparison.metrics} /></div>

      <footer className="portal-glass-panel flex flex-col items-center justify-between gap-4 rounded-[28px] border border-white/[0.12] px-5 py-5 text-center sm:flex-row sm:text-start">
        <span className="flex size-11 items-center justify-center rounded-2xl border border-[#d8be78]/20 bg-[#d8be78]/10 text-[#ead48d] shadow-[0_0_30px_rgba(216,190,120,.12)]"><Sparkles className="size-5" strokeWidth={1.7} aria-hidden /></span>
        <div className="sm:me-auto"><p className="text-xs font-medium text-[#e7e8ed]">{tReports("premiumReport")}</p><p className="mt-1 text-[10px] text-[#7f8799]">{tReports("premiumReportHint")}</p></div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#d8be78]/20 bg-[#d8be78]/[0.08] px-3 py-2 text-[9px] font-semibold tracking-[0.15em] text-[#dfc97f] uppercase"><Crown className="size-3.5" aria-hidden />GrowthLab VIP</span>
      </footer>
    </div>
  );
}
