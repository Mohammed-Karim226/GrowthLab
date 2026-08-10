import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, FileText, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { formatDate, formatDateRange } from "@/lib/format";
import { statusBadgeVariant } from "@/components/admin/status";
import type { ReportStatus } from "@/types/database";

export const dynamic = "force-dynamic";

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
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const [t, tStatus] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getTranslations({ locale, namespace: "status" }),
  ]);

  const supabase = await createClient();

  const [clientsResult, reportsResult] = await Promise.all([
    supabase.from("clients").select("id, is_active"),
    supabase
      .from("reports")
      .select(
        // FK named explicitly: `reports.current_published_version_id` also
        // points at report_versions, so a bare embed is ambiguous (PGRST201).
        "id, title, period_start, period_end, updated_at, client_id, clients(name), report_versions!report_versions_report_id_fkey(status, version_number)"
      )
      .order("updated_at", { ascending: false })
      .limit(8)
      .returns<RecentReport[]>(),
  ]);

  const clients = clientsResult.data ?? [];
  const reports = reportsResult.data ?? [];

  const { count: totalReports } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true });

  const awaitingReview = reports.filter((report) =>
    report.report_versions.some((version) => version.status === "needs_review")
  ).length;

  const stats = [
    { key: "totalClients", value: clients.length, icon: Users },
    { key: "activeClients", value: clients.filter((client) => client.is_active).length, icon: Users },
    { key: "totalReports", value: totalReports ?? 0, icon: FileText },
    { key: "awaitingReview", value: awaitingReview, icon: FileText },
  ] as const;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-satoshi text-2xl text-white sm:text-3xl">{t("overview.title")}</h1>
          <p className="max-w-xl text-sm text-slate-400">{t("overview.subtitle")}</p>
        </div>
        <Link
          href={`/${locale}/admin/clients`}
          className="button-primary button-shine inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white"
        >
          {t("overview.quickCreate")}
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.key} className="liquid-card border-white/[0.06] bg-white/[0.02]">
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div className="space-y-1">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    {t(`overview.${stat.key}` as never)}
                  </p>
                  <p className="font-satoshi text-2xl text-white">{stat.value}</p>
                </div>
                <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400">
                  <Icon className="size-4" aria-hidden />
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="liquid-card border-white/[0.06] bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="text-base text-white">{t("overview.recentReports")}</CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">{t("overview.noReports")}</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {reports.map((report) => {
                const latest = [...report.report_versions].sort(
                  (a, b) => b.version_number - a.version_number
                )[0];

                return (
                  <li key={report.id}>
                    <Link
                      href={`/${locale}/admin/reports/${report.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:text-white"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-sm text-slate-200">{report.title}</p>
                        <p className="text-xs text-slate-500">
                          {report.clients?.name ?? "—"} ·{" "}
                          {formatDateRange(report.period_start, report.period_end, locale)}
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
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
