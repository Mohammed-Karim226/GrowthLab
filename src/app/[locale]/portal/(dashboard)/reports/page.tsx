import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { requireClient } from "@/lib/auth";
import { listPublishedPeriods } from "@/lib/portal/data";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { formatDate, formatDateRange } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Published history for the signed-in client. Drafts never reach this list. */
export default async function PortalReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;

  const session = await requireClient(locale);
  const t = await getTranslations({ locale, namespace: "portal.reports" });

  const periods = await listPublishedPeriods(session.clientId);

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-satoshi text-2xl text-white sm:text-3xl">{t("title")}</h1>
        <p className="max-w-xl text-sm text-slate-400">{t("subtitle")}</p>
      </header>

      {periods.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center text-sm text-slate-400">
          {t("empty")}
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
          {periods.map((period) => (
            <li key={period.reportId}>
              <Link
                href={`/${locale}/portal/reports/${period.reportId}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-white/[0.03]"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm text-slate-100">{period.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateRange(period.periodStart, period.periodEnd, locale)}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500">
                    {t("published")} · {formatDate(period.publishedAt, locale)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                    {t("open")}
                    <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
