import "server-only";

import { comparePeriods } from "@/lib/analytics/comparisons";
import type { createClient } from "@/lib/supabase/server";
import type { AiJobRow, AiSummaryPayload, BatchStatus, MetricRow, ReportStatus } from "@/types/database";
import type { ReportExportRequest, ReportPdfData, ReportPdfMetric } from "./contract";

/** Expected export failures are translated into HTTP responses by the route. */
export class ReportExportError extends Error {
  constructor(
    public readonly status: 404 | 409 | 422,
    public readonly errorKey: "notFound" | "staleReport" | "batchProcessing" | "noMetrics",
  ) {
    super(errorKey);
    this.name = "ReportExportError";
  }
}

type DatabaseClient = Awaited<ReturnType<typeof createClient>>;
type VersionSnapshot = {
  id: string;
  report_id: string;
  version_number: number;
  revision: number;
  status: ReportStatus;
  published_at: string | null;
  summary: string | null;
  ai_summary: AiSummaryPayload | null;
  insight_batches: Array<{ status: BatchStatus; ai_jobs: Array<Pick<AiJobRow, "status">> }>;
  reports: {
    id: string;
    title: string;
    client_id: string;
    current_published_version_id: string | null;
    period_start: string;
    period_end: string;
    clients: { name: string; company_name: string | null } | null;
  } | null;
};

type PreviousReport = {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  current_published_version_id: string;
};

const VERSION_COLUMNS = "id, report_id, version_number, revision, status, published_at, summary, ai_summary, insight_batches(status, ai_jobs(status)), reports!report_versions_report_id_fkey(id, title, client_id, current_published_version_id, period_start, period_end, clients(name, company_name))";
const METRIC_COLUMNS = "*, insight_batches!metrics_insight_batch_id_fkey(account_id, accounts(page_name, page_id, stage))";
const METRIC_PAGE_SIZE = 500;

async function loadVersion(db: DatabaseClient, reportId: string, versionId: string) {
  const { data, error } = await db.from("report_versions")
    .select(VERSION_COLUMNS)
    .eq("id", versionId)
    .eq("report_id", reportId)
    .maybeSingle<VersionSnapshot>();
  if (error) throw error;
  if (!data || data.id !== versionId || data.report_id !== reportId || data.reports?.id !== reportId) return null;
  return data;
}

/** Read every row in stable order, including reports above PostgREST's row cap. */
async function loadMetrics(db: DatabaseClient, versionId: string): Promise<ReportPdfMetric[]> {
  const result: ReportPdfMetric[] = [];
  for (let offset = 0; ; ) {
    const { data, error, count } = await db.from("metrics")
      .select(METRIC_COLUMNS, { count: "exact" })
      .eq("report_version_id", versionId)
      .order("id", { ascending: true })
      .range(offset, offset + METRIC_PAGE_SIZE - 1)
      .returns<Array<MetricRow & {
        insight_batches: {
          account_id: string | null;
          accounts: { page_name: string | null; page_id: string | null; stage: string | null } | null;
        } | null;
      }>>();
    if (error) throw error;
    // Deployments may configure max_rows below our requested page size. The
    // exact count distinguishes a server-capped page from the final page.
    if (count === null || count === undefined || (!data?.length && offset < count)) {
      throw new Error("Report metric pagination returned an incomplete result");
    }
    for (const metric of data ?? []) {
      const { insight_batches: batch, ...row } = metric;
      result.push({
        ...row,
        accountId: batch?.account_id ?? null,
        accountName: batch?.accounts?.page_name ?? batch?.accounts?.page_id ?? null,
        accountStage: batch?.accounts?.stage ?? null,
      });
    }
    offset += data?.length ?? 0;
    if (offset >= count) return result;
  }
}

function reviewedMetrics(metrics: ReportPdfMetric[]): ReportPdfMetric[] {
  return metrics.filter((metric) => !metric.needs_review && metric.metric_value !== null && Number.isFinite(metric.metric_value));
}

function sameSnapshot(before: VersionSnapshot, after: VersionSnapshot | null): boolean {
  return Boolean(after && before.revision === after.revision && before.status === after.status
    && JSON.stringify(before.reports) === JSON.stringify(after.reports));
}

function isProcessing(version: VersionSnapshot): boolean {
  return version.status === "processing" || version.insight_batches.some((batch) => batch.status === "processing"
    || batch.ai_jobs.some((job) => job.status === "queued" || job.status === "processing"));
}

/**
 * Export a specific, verified version. The second version read guards the
 * paginated metric snapshot against edits, deletions and publication changes.
 */
async function loadReportPdfData(
  db: DatabaseClient,
  input: Pick<ReportExportRequest, "reportVersionId" | "revision"> & { reportId: string },
): Promise<ReportPdfData> {
  const version = await loadVersion(db, input.reportId, input.reportVersionId);
  if (!version?.reports) throw new ReportExportError(404, "notFound");
  if (version.revision !== input.revision) throw new ReportExportError(409, "staleReport");
  if (version.status === "published" && version.reports.current_published_version_id !== version.id) {
    throw new ReportExportError(409, "staleReport");
  }
  if (isProcessing(version)) throw new ReportExportError(409, "batchProcessing");
  const report = version.reports;
  const allMetrics = await loadMetrics(db, version.id);
  const metrics = reviewedMetrics(allMetrics);
  if (metrics.length === 0) throw new ReportExportError(422, "noMetrics");

  // Match summary generation: the most recent published period that ended
  // before this report began, for this client only. Drafts never shape growth.
  const { data: previousReport, error: previousError } = await db.from("reports")
    .select("id, title, period_start, period_end, current_published_version_id")
    .eq("client_id", report.client_id)
    .neq("id", report.id)
    .not("current_published_version_id", "is", null)
    .lt("period_end", report.period_start)
    .order("period_end", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle<PreviousReport>();
  if (previousError) throw previousError;

  let previousVersion: VersionSnapshot | null = null;
  let previousMetrics: ReportPdfMetric[] = [];
  if (previousReport) {
    previousVersion = await loadVersion(db, previousReport.id, previousReport.current_published_version_id);
    if (previousVersion?.status === "published" && previousVersion.reports?.client_id === report.client_id
      && previousVersion.reports.current_published_version_id === previousVersion.id) {
      // The previous report could have been renamed or moved to another period
      // after the candidate query. Never label its figures with stale metadata.
      if (previousVersion.reports.title !== previousReport.title
        || previousVersion.reports.period_start !== previousReport.period_start
        || previousVersion.reports.period_end !== previousReport.period_end) {
        throw new ReportExportError(409, "staleReport");
      }
      previousMetrics = reviewedMetrics(await loadMetrics(db, previousVersion.id));
    } else {
      previousVersion = null;
    }
  }

  const latest = await loadVersion(db, report.id, version.id);
  if (latest && isProcessing(latest)) throw new ReportExportError(409, "batchProcessing");
  if (!sameSnapshot(version, latest)) throw new ReportExportError(409, "staleReport");
  if (previousVersion) {
    const previousLatest = await loadVersion(db, previousVersion.report_id, previousVersion.id);
    if (!sameSnapshot(previousVersion, previousLatest)) throw new ReportExportError(409, "staleReport");
  }

  return {
    report: {
      id: report.id,
      title: report.title,
      clientName: report.clients?.name ?? "",
      companyName: report.clients?.company_name ?? null,
      periodStart: report.period_start,
      periodEnd: report.period_end,
    },
    version: {
      id: version.id,
      number: version.version_number,
      revision: version.revision,
      status: version.status,
      publishedAt: version.published_at,
      summary: version.summary,
      aiSummary: version.ai_summary,
    },
    metrics,
    comparison: comparePeriods(metrics, previousMetrics.length ? previousMetrics : null),
    previousPeriod: previousVersion && previousReport && previousMetrics.length ? {
      title: previousReport.title,
      periodStart: previousReport.period_start,
      periodEnd: previousReport.period_end,
      versionNumber: previousVersion.version_number,
    } : null,
    excludedMetrics: allMetrics.length - metrics.length,
    totalMetrics: allMetrics.length,
    generatedAt: new Date().toISOString(),
  };
}

function contentDisposition(data: ReportPdfData): string {
  const name = `${data.report.title}-${data.report.periodStart}-v${data.version.number}`;
  const safeName = Array.from(name.normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069/\\<>:"|?*]/g, "-")).slice(0, 160).join("").trim() || "report";
  const asciiName = safeName.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-") || "report";
  const encodedName = encodeURIComponent(`${safeName}.pdf`).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${asciiName}.pdf"; filename*=UTF-8''${encodedName}`;
}

/** Validate the saved snapshot before loading the expensive PDF renderer. */
export async function exportReportPdf(
  db: DatabaseClient,
  input: ReportExportRequest & { reportId: string },
): Promise<{ buffer: Buffer; contentDisposition: string }> {
  const { reportId, reportVersionId, revision, ...options } = input;
  const data = await loadReportPdfData(db, { reportId, reportVersionId, revision });
  const { renderReportPdf } = await import("@/lib/reports/export/document");
  const buffer = await renderReportPdf(data, options);
  return { buffer, contentDisposition: contentDisposition(data) };
}
