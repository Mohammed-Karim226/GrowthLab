import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowUpRight,
  Crown,
  FileCheck2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { formatDate, formatDateRange } from "@/lib/format";
import { statusBadgeVariant } from "@/components/admin/status";
import PaginationNav from "@/components/ui/PaginationNav";
import type { ReportStatus } from "@/types/database";
import {
  DashboardQuickAction,
  ClientGrowthChart,
  DashboardStatBox,
} from "@/components/admin/DashboardMotion";

export const dynamic = "force-dynamic";

const REPORTS_PER_PAGE = 8;

type RecentReport = {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  updated_at: string;
  client_id: string;
  clients: { name: string } | null;
  report_versions: Array<{ status: ReportStatus; version_number: number }>;
};

export default async function AdminOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale: raw }, search] = await Promise.all([params, searchParams]);
  const locale = isLocale(raw) ? raw : defaultLocale;
  const [t, tStatus, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getTranslations({ locale, namespace: "status" }),
    getTranslations({ locale, namespace: "common" }),
  ]);

  const supabase = await createClient();

  const [clientsResult, totalReportsResult, reviewResult] = await Promise.all([
    supabase.from("clients").select("id, is_active, created_at"),
    supabase.from("reports").select("id", { count: "exact", head: true }),
    supabase.from("reports")
      .select("id, report_versions!report_versions_report_id_fkey!inner(status)", { count: "exact", head: true })
      .eq("report_versions.status", "needs_review"),
  ]);
  if (clientsResult.error) throw clientsResult.error;
  if (totalReportsResult.error) throw totalReportsResult.error;
  if (reviewResult.error) throw reviewResult.error;

  const totalReports = totalReportsResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalReports / REPORTS_PER_PAGE));
  const rawPage = Array.isArray(search.reportsPage) ? search.reportsPage[0] : search.reportsPage;
  const requestedPage = Number(rawPage ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, totalPages)
    : 1;
  const start = (page - 1) * REPORTS_PER_PAGE;
  const reportsResult = await supabase.from("reports")
    .select(
      // FK named explicitly: `reports.current_published_version_id` also
      // points at report_versions, so a bare embed is ambiguous (PGRST201).
      "id, title, period_start, period_end, updated_at, client_id, clients(name), report_versions!report_versions_report_id_fkey(status, version_number)",
    )
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range(start, start + REPORTS_PER_PAGE - 1)
    .returns<RecentReport[]>();
  if (reportsResult.error) throw reportsResult.error;

  const clients = clientsResult.data ?? [];
  const reports = reportsResult.data ?? [];
  const awaitingReview = reviewResult.count ?? 0;

  function reportsPageHref(nextPage: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) {
      if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
      else if (value !== undefined) query.set(key, value);
    }
    query.set("reportsPage", String(nextPage));
    return `/${locale}/admin?${query.toString()}#recent-reports`;
  }

  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short" });
  const now = new Date();
  const clientGrowth = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const value = clients.filter((client) => new Date(client.created_at) < new Date(month.getFullYear(), month.getMonth() + 1, 1)).length;
    return { label: monthFormatter.format(month), value };
  });

  const stats = [
    {
      key: "totalClients",
      value: clients.length,
      icon: "users",
      tone: "violet",
    },
    {
      key: "activeClients",
      value: clients.filter((client) => client.is_active).length,
      icon: "active",
      tone: "emerald",
    },
    {
      key: "totalReports",
      value: totalReports ?? 0,
      icon: "files",
      tone: "gold",
    },
    {
      key: "awaitingReview",
      value: awaitingReview,
      icon: "review",
      tone: "cyan",
    },
  ] as const;

  return (
    <div className="space-y-8">
      <header className="admin-page-hero relative flex flex-wrap items-end justify-between gap-5 overflow-hidden rounded-3xl p-5 sm:p-7">
        <div className="relative z-10 space-y-2">
          <span className="admin-vip-eyebrow inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase">
            <Crown className="size-3" aria-hidden />{" "}
            {t("overview.vipIntelligence")}
          </span>
          <h1 className="font-satoshi text-2xl text-white sm:text-3xl">
            {t("overview.title")}
          </h1>
          <p className="max-w-xl text-sm text-slate-400">
            {t("overview.subtitle")}
          </p>
        </div>
        <ClientGrowthChart points={clientGrowth} total={clients.length} title={t("overview.totalClients")} />
        <div
          aria-hidden
          className="admin-hero-crown absolute -end-7 -top-10 opacity-[0.07]"
        >
          <Crown className="size-48 rotate-12" strokeWidth={1} />
        </div>
      </header>

      <section
        className="grid gap-3 sm:grid-cols-3"
        aria-label={t("overview.quickActionsTitle")}
      >
        <DashboardQuickAction
          href={`/${locale}/admin/clients`}
          icon="plus"
          tone="gold"
          title={t("overview.quickNewClient")}
          hint={t("overview.quickNewClientHint")}
        />
        <DashboardQuickAction
          href={`/${locale}/admin/template-creation`}
          icon="message"
          tone="cyan"
          title={t("overview.quickOutreach")}
          hint={t("overview.quickOutreachHint")}
        />
        <DashboardQuickAction
          href={`/${locale}/admin/clients`}
          icon="report"
          tone="emerald"
          title={t("overview.quickReports")}
          hint={t("overview.quickReportsHint")}
        />
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <DashboardStatBox
            key={stat.key}
            label={t(`overview.${stat.key}` as never)}
            value={stat.value}
            icon={stat.icon}
            tone={stat.tone}
          />
        ))}
      </div>

      <Card id="recent-reports" className="admin-reports-card scroll-mt-28">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <span className="flex size-8 items-center justify-center rounded-xl border border-[#ead178]/15 bg-[#ead178]/[0.07] text-[#efd77f]">
              <FileCheck2 className="size-4" aria-hidden />
            </span>
            {t("overview.recentReports")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              {t("overview.noReports")}
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {reports.map((report) => {
                const latest = [...report.report_versions].sort(
                  (a, b) => b.version_number - a.version_number,
                )[0];

                return (
                  <li key={report.id}>
                    <Link
                      href={`/${locale}/admin/reports/${report.id}`}
                      className="admin-report-row group flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-3.5 transition-all hover:text-white"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-sm text-slate-200">
                          {report.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {report.clients?.name ?? "—"} ·{" "}
                          {formatDateRange(
                            report.period_start,
                            report.period_end,
                            locale,
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {latest && (
                          <Badge variant={statusBadgeVariant(latest.status)}>
                            {tStatus(latest.status)}
                          </Badge>
                        )}
                        <span className="text-xs text-slate-500">
                          {formatDate(report.updated_at, locale)}
                        </span>
                        <ArrowUpRight
                          className="size-3.5 text-slate-600 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#efd77f] rtl:-scale-x-100"
                          aria-hidden
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {totalPages > 1 && (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <PaginationNav
                previousHref={page > 1 ? reportsPageHref(page - 1) : null}
                nextHref={page < totalPages ? reportsPageHref(page + 1) : null}
                previousLabel={tCommon("previous")}
                nextLabel={tCommon("next")}
                statusLabel={t("overview.reportsPagination", { page, pages: totalPages, total: totalReports })}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
