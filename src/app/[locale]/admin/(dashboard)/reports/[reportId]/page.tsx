import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import MetricReviewTable, { type ReviewMetric } from "@/components/admin/MetricReviewTable";
import SummaryPanel from "@/components/admin/SummaryPanel";
import UploadWorkspace from "@/components/admin/UploadWorkspace";
import VersionActions from "@/components/admin/VersionActions";
import { statusBadgeVariant } from "@/components/admin/status";
import { createClient } from "@/lib/supabase/server";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { formatDateRange } from "@/lib/format";
import {
  PLATFORMS,
  type AiSummaryPayload,
  type BatchStatus,
  type MetricRow,
  type Platform,
  type ReportStatus,
} from "@/types/database";

export const dynamic = "force-dynamic";

type ReportRecord = {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  client_id: string;
  current_published_version_id: string | null;
  clients: { id: string; name: string } | null;
  report_versions: Array<{
    id: string;
    version_number: number;
    status: ReportStatus;
    ai_summary: AiSummaryPayload | null;
    published_at: string | null;
  }>;
};

type BatchRecord = {
  id: string;
  platform: Platform;
  status: BatchStatus;
  notes: string | null;
  insight_images: Array<{
    id: string;
    original_filename: string | null;
    file_size: number | null;
    sort_order: number;
  }>;
};

export default async function ReportWorkspacePage({
  params,
}: {
  params: Promise<{ locale: string; reportId: string }>;
}) {
  const { locale: raw, reportId } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const [t, tStatus] = await Promise.all([
    getTranslations({ locale, namespace: "admin.workspace" }),
    getTranslations({ locale, namespace: "status" }),
  ]);

  const supabase = await createClient();

  const { data: report, error } = await supabase
    .from("reports")
    .select(
      // FK named explicitly: `current_published_version_id` points the other
      // way across the same pair of tables, so a bare embed is ambiguous.
      "id, title, period_start, period_end, client_id, current_published_version_id, clients(id, name), report_versions!report_versions_report_id_fkey(id, version_number, status, ai_summary, published_at)"
    )
    .eq("id", reportId)
    .maybeSingle<ReportRecord>();

  if (error) throw error;
  if (!report) notFound();

  // The workspace always edits the newest version; published ones are read-only.
  const version = [...report.report_versions].sort(
    (a, b) => b.version_number - a.version_number
  )[0];

  if (!version) notFound();

  const { data: batches } = await supabase
    .from("insight_batches")
    .select("id, platform, status, notes, insight_images(id, original_filename, file_size, sort_order)")
    .eq("report_version_id", version.id)
    .returns<BatchRecord[]>();

  const byPlatform = new Map((batches ?? []).map((batch) => [batch.platform, batch]));

  const { data: metricRows } = await supabase
    .from("metrics")
    .select("*")
    .eq("report_version_id", version.id)
    .order("platform", { ascending: true })
    .order("metric_name", { ascending: true })
    .returns<MetricRow[]>();

  const metrics: ReviewMetric[] = (metricRows ?? []).map((metric) => ({
    id: metric.id,
    platform: metric.platform,
    metricName: metric.metric_name,
    metricValue: metric.metric_value,
    metricUnit: metric.metric_unit,
    metricDate: metric.metric_date,
    source: metric.source,
    confidence: metric.confidence,
    needsReview: metric.needs_review,
    note: metric.note,
  }));

  const pendingReview = metrics.filter((metric) => metric.needsReview).length;

  const locked = version.status === "published" || version.status === "archived";

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link
          href={`/${locale}/admin/clients/${report.client_id}`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-200"
        >
          <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
          {t("backToClient")}
        </Link>

        <header className="admin-section-header flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs text-slate-500">{report.clients?.name}</p>
            <h1 className="font-satoshi text-2xl text-white sm:text-3xl">{report.title}</h1>
            <p className="text-sm text-slate-400">
              {formatDateRange(report.period_start, report.period_end, locale)}
            </p>
          </div>
          <Badge variant={statusBadgeVariant(version.status)}>{tStatus(version.status)}</Badge>
        </header>
      </div>

      <UploadWorkspace
        locale={locale}
        reportVersionId={version.id}
        locked={locked}
        platforms={PLATFORMS.map((platform) => {
          const batch = byPlatform.get(platform);
          return {
            platform,
            batchId: batch?.id ?? null,
            status: batch?.status ?? null,
            notes: batch?.notes ?? null,
            images: [...(batch?.insight_images ?? [])]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((image) => ({
                id: image.id,
                filename: image.original_filename,
                fileSize: image.file_size,
              })),
          };
        })}
      />

      <MetricReviewTable locale={locale} metrics={metrics} locked={locked} />

      <SummaryPanel
        locale={locale}
        reportId={report.id}
        reportVersionId={version.id}
        summary={version.ai_summary}
        locked={locked}
        // The summary is written from reviewed numbers only, so it stays out of
        // reach until the review is actually done (plan §4).
        hasReviewedMetrics={metrics.length > 0 && pendingReview === 0}
      />

      <VersionActions
        locale={locale}
        reportId={report.id}
        reportVersionId={version.id}
        versionNumber={version.version_number}
        status={version.status}
        publishedAt={version.published_at}
        metricCount={metrics.length}
        pendingReview={pendingReview}
      />
    </div>
  );
}
