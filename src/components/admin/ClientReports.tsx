"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarRange, ChevronRight, Crown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CreateReportDialog from "@/components/admin/CreateReportDialog";
import { statusBadgeVariant } from "@/components/admin/status";
import { formatDate, formatDateRange } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { ReportStatus } from "@/types/database";
import PaginationNav from "@/components/ui/PaginationNav";

export type ReportListItem = {
  id: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
  status: ReportStatus;
  versionNumber: number;
  isPublished: boolean;
};

export default function ClientReports({
  clientId,
  locale,
  reports,
  previousHref,
  nextHref,
}: {
  clientId: string;
  locale: Locale;
  reports: ReportListItem[];
  previousHref: string | null;
  nextHref: string | null;
}) {
  const t = useTranslations("admin.clients.detail");
  const tReports = useTranslations("admin.reports");
  const tStatus = useTranslations("status");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Card className="admin-reports-card">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base text-white">{t("reports")}</CardTitle>
          <Button
            type="button"
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="button-primary rounded-full text-white"
          >
            <Crown className="size-3.5" aria-hidden />
            {t("newReport")}
          </Button>
        </CardHeader>

        <CardContent>
          {reports.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-500">
                <CalendarRange className="size-5" aria-hidden />
              </span>
              <p className="text-sm text-slate-300">{t("noReports")}</p>
              <p className="max-w-sm text-xs text-slate-500">{t("noReportsHint")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {reports.map((report) => (
                <li key={report.id}>
                  <Link
                    href={`/${locale}/admin/reports/${report.id}`}
                    className="group flex items-center justify-between gap-4 py-3.5"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm text-slate-100 group-hover:text-white">
                        {report.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateRange(report.periodStart, report.periodEnd, locale)} ·{" "}
                        {tReports("version", { number: report.versionNumber })} ·{" "}
                        {formatDate(report.updatedAt, locale)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5">
                      <Badge variant={statusBadgeVariant(report.status)}>
                        {tStatus(report.status)}
                      </Badge>
                      <ChevronRight
                        aria-hidden
                        className="size-4 text-slate-600 transition-colors group-hover:text-slate-300 rtl:rotate-180"
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <div className="mt-4"><PaginationNav previousHref={previousHref} nextHref={nextHref} previousLabel={tCommon("previous")} nextLabel={tCommon("next")} /></div>

      <CreateReportDialog
        clientId={clientId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(reportId) => {
          setDialogOpen(false);
          router.push(`/${locale}/admin/reports/${reportId}`);
        }}
      />
    </>
  );
}
