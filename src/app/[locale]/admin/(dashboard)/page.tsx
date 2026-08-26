import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  ArrowUpRight,
  Crown,
  FileCheck2,
  Files,
  MessageCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";

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
        "id, title, period_start, period_end, updated_at, client_id, clients(name), report_versions!report_versions_report_id_fkey(status, version_number)",
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
    report.report_versions.some((version) => version.status === "needs_review"),
  ).length;

  const stats = [
    { key: "totalClients", value: clients.length, icon: Users, tone: "violet" },
    {
      key: "activeClients",
      value: clients.filter((client) => client.is_active).length,
      icon: UserCheck,
      tone: "emerald",
    },
    {
      key: "totalReports",
      value: totalReports ?? 0,
      icon: Files,
      tone: "gold",
    },
    {
      key: "awaitingReview",
      value: awaitingReview,
      icon: ShieldCheck,
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
        <Link
          href={`/${locale}/admin/clients`}
          className="button-primary button-shine relative z-10 inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-[#171204]"
        >
          <Sparkles className="size-4" aria-hidden />
          {t("overview.quickCreate")}
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
        <div
          aria-hidden
          className="admin-hero-crown absolute -end-7 -top-10 opacity-[0.07]"
        >
          <Crown className="size-48 rotate-12" strokeWidth={1} />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label={t("overview.quickActionsTitle")}>
        <Link href={`/${locale}/admin/clients`} className="admin-quick-action group flex items-center gap-3 rounded-2xl border border-white/[0.1] bg-white/[0.045] p-4 transition-all hover:-translate-y-0.5 hover:border-[#ead178]/35 hover:bg-white/[0.08]">
          <span className="flex size-10 items-center justify-center rounded-xl border border-[#ead178]/20 bg-[#ead178]/10 text-[#efd77f]"><Plus className="size-4" /></span>
          <span><span className="block text-sm font-semibold text-white">{t("overview.quickNewClient")}</span><span className="mt-0.5 block text-xs text-slate-500">{t("overview.quickNewClientHint")}</span></span>
          <ArrowUpRight className="ms-auto size-4 text-slate-600 transition-colors group-hover:text-[#efd77f]" />
        </Link>
        <Link href={`/${locale}/admin/template-creation`} className="admin-quick-action group flex items-center gap-3 rounded-2xl border border-white/[0.1] bg-white/[0.045] p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.08]">
          <span className="flex size-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200"><MessageCircle className="size-4" /></span>
          <span><span className="block text-sm font-semibold text-white">{t("overview.quickOutreach")}</span><span className="mt-0.5 block text-xs text-slate-500">{t("overview.quickOutreachHint")}</span></span>
          <ArrowUpRight className="ms-auto size-4 text-slate-600 transition-colors group-hover:text-cyan-200" />
        </Link>
        <Link href={`/${locale}/admin/clients`} className="admin-quick-action group flex items-center gap-3 rounded-2xl border border-white/[0.1] bg-white/[0.045] p-4 transition-all hover:-translate-y-0.5 hover:border-emerald-300/35 hover:bg-white/[0.08]">
          <span className="flex size-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200"><FileCheck2 className="size-4" /></span>
          <span><span className="block text-sm font-semibold text-white">{t("overview.quickReports")}</span><span className="mt-0.5 block text-xs text-slate-500">{t("overview.quickReportsHint")}</span></span>
          <ArrowUpRight className="ms-auto size-4 text-slate-600 transition-colors group-hover:text-emerald-200" />
        </Link>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.key}
              className={`admin-stat-card admin-stat-${stat.tone}`}
            >
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div className="space-y-1">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    {t(`overview.${stat.key}` as never)}
                  </p>
                  <p className="font-satoshi text-2xl text-white">
                    {stat.value}
                  </p>
                </div>
                <span className="admin-stat-icon flex size-11 items-center justify-center rounded-2xl">
                  <Icon className="size-5" aria-hidden />
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="admin-reports-card">
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
        </CardContent>
      </Card>
    </div>
  );
}
