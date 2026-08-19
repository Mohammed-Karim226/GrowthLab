import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, CalendarRange, CheckCircle2, FileBarChart, ShieldCheck } from "lucide-react";

import { requireClient } from "@/lib/auth";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { formatDate, formatDateRange } from "@/lib/format";
import PaginationNav from "@/components/ui/PaginationNav";
import { listPublishedPeriodsPage } from "@/lib/portal/data";

export const dynamic = "force-dynamic";

export default async function PortalReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cursor?: string; direction?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;

  const session = await requireClient(locale);
  const [t, tUi, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: "portal.reports" }),
    getTranslations({ locale, namespace: "portal.ui" }),
    getTranslations({ locale, namespace: "common" }),
  ]);
  const query = await searchParams;
  const page = await listPublishedPeriodsPage(session.clientId, {
    cursor: query.cursor,
    direction: query.direction === "prev" ? "prev" : "next",
  });
  const periods = page.periods;
  const pageHref = (cursor: string | null, direction: "next" | "prev") =>
    cursor ? `/${locale}/portal/reports?cursor=${encodeURIComponent(cursor)}&direction=${direction}` : null;

  return (
    <div className="space-y-8">
      <header className="portal-glass-panel portal-reveal flex flex-col justify-between gap-6 rounded-[34px] border border-white/[0.14] px-5 py-7 sm:flex-row sm:items-end sm:px-8 sm:py-9">
        <div className="max-w-2xl">
          <span className="mb-5 flex size-11 items-center justify-center rounded-2xl border border-[#d8be78]/15 bg-[#d8be78]/[0.07] text-[#dac37f]">
            <FileBarChart className="size-5" strokeWidth={1.7} aria-hidden />
          </span>
          <p className="text-[9px] font-semibold tracking-[0.22em] text-[#79776f] uppercase">{tUi("reportArchive")}</p>
          <h1 className="mt-1 font-satoshi text-3xl tracking-[-0.045em] text-[#f5f1e8] sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#85837b]">{t("subtitle")}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#54d8ac]/10 bg-[#54d8ac]/[0.045] px-3 py-2 text-[10px] font-medium text-[#72d7b6]">
          <ShieldCheck className="size-3.5" strokeWidth={1.8} />
          {tUi("verifiedReports", { count: page.total })}
        </div>
      </header>

      {periods.length === 0 ? (
        <p className="rounded-[26px] border border-dashed border-white/[0.08] bg-black/10 px-6 py-20 text-center text-sm text-[#77766f]">
          {t("empty")}
        </p>
      ) : (
        <div className="relative space-y-3 before:absolute before:inset-y-8 before:start-[27px] before:w-px before:bg-gradient-to-b before:from-[#d8be78]/35 before:via-white/[0.07] before:to-transparent sm:before:start-[35px]">
          {periods.map((period, index) => (
            <Link
              key={period.reportId}
              href={`/${locale}/portal/reports/${period.reportId}`}
              className="portal-report-row portal-reveal group relative flex gap-4 overflow-hidden rounded-[24px] border border-white/[0.06] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#d8be78]/20 sm:gap-6 sm:p-5"
              style={{ animationDelay: `${index * 55}ms` }}
            >
              <span className="relative z-10 flex size-[38px] shrink-0 items-center justify-center rounded-[13px] border border-[#d8be78]/15 bg-[#15140f] text-[#d8be78] shadow-[0_8px_24px_rgba(0,0,0,0.2)] sm:size-[42px]">
                {index === 0 ? (
                  <CheckCircle2 className="size-[18px]" strokeWidth={1.8} aria-hidden />
                ) : (
                  <span className="text-[11px] font-semibold tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                )}
              </span>

              <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-satoshi text-base tracking-[-0.02em] text-[#efede6] sm:text-lg">
                      {period.title}
                    </h2>
                    {index === 0 && (
                      <span className="rounded-full border border-[#54d8ac]/12 bg-[#54d8ac]/[0.06] px-2 py-0.5 text-[8px] font-semibold tracking-[0.12em] text-[#6ed8b5] uppercase">
                        {tUi("latest")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-[#77766f]">
                    <CalendarRange className="size-3.5" strokeWidth={1.7} aria-hidden />
                    {formatDateRange(period.periodStart, period.periodEnd, locale)}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4 sm:mt-0 sm:shrink-0 sm:justify-end">
                  <span className="text-[10px] text-[#696861]">
                    {t("published")} · {formatDate(period.publishedAt, locale)}
                  </span>
                  <span className="flex size-10 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.025] text-[#908d84] transition-all group-hover:border-[#d8be78]/20 group-hover:bg-[#d8be78]/10 group-hover:text-[#ddc77f]">
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
                  </span>
                </div>
              </div>
            </Link>
          ))}
          <PaginationNav previousHref={pageHref(page.previousCursor, "prev")} nextHref={pageHref(page.nextCursor, "next")} previousLabel={tCommon("previous")} nextLabel={tCommon("next")} />
        </div>
      )}
    </div>
  );
}
