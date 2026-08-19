import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Mail } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ClientReports from "@/components/admin/ClientReports";
import AccountManager from "@/components/admin/AccountManager";
import { createClient } from "@/lib/supabase/server";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import type { AccountRow, ClientRow, ReportStatus } from "@/types/database";
import { decodeCursor, encodeCursor } from "@/lib/pagination";

export const dynamic = "force-dynamic";

type ReportWithVersions = {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  updated_at: string;
  current_published_version_id: string | null;
  report_versions: Array<{ id: string; version_number: number; status: ReportStatus }>;
};

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; clientId: string }>;
  searchParams: Promise<{ cursor?: string; direction?: string }>;
}) {
  const [{ locale: raw, clientId }, search] = await Promise.all([params, searchParams]);
  const locale = isLocale(raw) ? raw : defaultLocale;
  const [t, tStatus] = await Promise.all([
    getTranslations({ locale, namespace: "admin.clients.detail" }),
    getTranslations({ locale, namespace: "status" }),
  ]);

  const supabase = await createClient();

  // RLS decides visibility; a non-admin session simply gets no row here.
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle<ClientRow>();

  if (error) throw error;
  if (!client) notFound();

  const cursor = decodeCursor(search.cursor);
  const previousDirection = search.direction === "prev";
  let reportsQuery = supabase
    .from("reports")
    .select(
      // FK named explicitly: `current_published_version_id` points the other
      // way across the same pair of tables, so a bare embed is ambiguous.
      "id, title, period_start, period_end, updated_at, current_published_version_id, report_versions!report_versions_report_id_fkey(id, version_number, status)"
    )
    .eq("client_id", clientId)
    .order("period_end", { ascending: previousDirection })
    .order("id", { ascending: previousDirection })
    .limit(21);
  if (cursor) {
    const operator = previousDirection ? "gt" : "lt";
    reportsQuery = reportsQuery.or(`period_end.${operator}.${cursor.value},and(period_end.eq.${cursor.value},id.${operator}.${cursor.id})`);
  }
  const { data: reportRows, error: reportsError } = await reportsQuery.returns<ReportWithVersions[]>();
  if (reportsError) throw reportsError;
  const hasMoreReports = (reportRows?.length ?? 0) > 20;
  const reports = (reportRows ?? []).slice(0, 20);
  if (previousDirection) reports.reverse();
  const reportHref = (report: ReportWithVersions | undefined, direction: "next" | "prev") => report
    ? `/${locale}/admin/clients/${clientId}?cursor=${encodeURIComponent(encodeCursor({ value: report.period_end, id: report.id }))}&direction=${direction}`
    : null;
  const previousReportsHref = (previousDirection ? hasMoreReports : Boolean(cursor)) ? reportHref(reports[0], "prev") : null;
  const nextReportsHref = (previousDirection ? Boolean(cursor) : hasMoreReports) ? reportHref(reports[reports.length - 1], "next") : null;

  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("*")
    .eq("client_id", clientId)
    .order("platform")
    .order("page_name")
    .returns<AccountRow[]>();
  if (accountsError) throw accountsError;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link
          href={`/${locale}/admin/clients`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-200"
        >
          <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
          {t("backToClients")}
        </Link>

        <header className="admin-section-header flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="font-satoshi text-2xl text-white sm:text-3xl">{client.name}</h1>
            {client.company_name && (
              <p className="text-sm text-slate-400">{client.company_name}</p>
            )}
          </div>
          <Badge variant={client.is_active ? "success" : "muted"}>
            {tStatus(client.is_active ? "active" : "inactive")}
          </Badge>
        </header>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ClientReports
          clientId={client.id}
          locale={locale}
          reports={(reports ?? []).map((report) => {
            const latest = [...report.report_versions].sort(
              (a, b) => b.version_number - a.version_number
            )[0];
            return {
              id: report.id,
              title: report.title,
              periodStart: report.period_start,
              periodEnd: report.period_end,
              updatedAt: report.updated_at,
              status: latest?.status ?? "draft",
              versionNumber: latest?.version_number ?? 1,
              isPublished: Boolean(report.current_published_version_id),
            };
          })}
          previousHref={previousReportsHref}
          nextHref={nextReportsHref}
        />

        <aside className="space-y-6">
          <AccountManager clientId={client.id} accounts={accounts ?? []} />
          <Card className="liquid-card border-white/[0.06] bg-white/[0.02]">
            <CardHeader>
              <CardTitle className="text-sm text-white">{t("editTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{t("portalEmail")}</p>
                <p dir="ltr" className="flex items-center gap-1.5 break-all text-slate-300">
                  <Mail className="size-3.5 shrink-0 text-slate-500" aria-hidden />
                  {client.contact_email ?? "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-slate-500">{formatDate(client.created_at, locale)}</p>
              </div>

              {client.notes && (
                <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs whitespace-pre-wrap text-slate-400">
                  {client.notes}
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
