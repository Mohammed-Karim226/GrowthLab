import { getTranslations } from "next-intl/server";
import { FileBarChart, Sparkles } from "lucide-react";

import InsightsPanel from "@/components/portal/InsightsPanel";
import { requireClient } from "@/lib/auth";
import { listPublishedPeriods, loadPortalMetrics } from "@/lib/portal/data";
import { comparePeriods } from "@/lib/analytics/comparisons";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { formatDate, formatDateRange } from "@/lib/format";
import PortalHero from "@/components/portal/PortalHero";
import ReportIntelligenceBrief from "@/components/portal/ReportIntelligenceBrief";
import AnalyticsWorkspace from "@/components/portal/AnalyticsWorkspace";

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

  const metricsByVersion = await loadPortalMetrics(periods.map((period) => period.versionId));

  const [latest, previous] = periods;
  const latestMetrics = metricsByVersion.get(latest.versionId) ?? [];
  const previousMetrics = previous ? (metricsByVersion.get(previous.versionId) ?? []) : null;

  const comparison = comparePeriods(latestMetrics, previousMetrics);

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

      <AnalyticsWorkspace locale={locale} periods={periods.map((period) => ({ ...period, metrics: metricsByVersion.get(period.versionId) ?? [] }))} />

      <section className="portal-feature-gateway relative space-y-6 rounded-[30px] border border-[#8f78e8]/20 bg-[#110f26]/45 p-3 sm:space-y-8 sm:p-5 lg:p-6">
        <div className="portal-feature-gateway-heading flex flex-col gap-3 border-b border-[#d8be78]/15 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[9px] font-semibold tracking-[0.22em] text-[#d8be78] uppercase">{t("featureEyebrow")}</p>
            <h2 className="mt-1 font-satoshi text-2xl tracking-[-0.04em] text-[#f4f0e7] sm:text-3xl">{t("deepDiveTitle")}</h2>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-[#9992b2]">{t("deepDiveHint")}</p>
        </div>

        <InsightsPanel summary={latest.summary} aiSummary={latest.aiSummary} />
      </section>
    </div>
  );
}
