import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { INSIGHTS_BUCKET } from "@/lib/uploads";
import { decodeCursor, encodeCursor } from "@/lib/pagination";
import { PLATFORMS, type AiSummaryPayload, type MetricRow, type Platform } from "@/types/database";

export type PublishedPeriod = { reportId: string; versionId: string; versionNumber: number; title: string; periodStart: string; periodEnd: string; publishedAt: string | null; summary: string | null; aiSummary: AiSummaryPayload | null };
export type PublishedPeriodsPage = { periods: PublishedPeriod[]; total: number; previousCursor: string | null; nextCursor: string | null };
export type PortalMetric = MetricRow & {
  accountId: string | null;
  accountName: string | null;
  accountStage: string | null;
};
export type GalleryImage = {
  id: string;
  url: string;
  filename: string | null;
  platform: Platform;
  accountId: string | null;
  reportId: string;
  reportTitle: string;
  periodStart: string;
  periodEnd: string;
};
export type GalleryMonth = {
  month: string;
  coverUrl: string | null;
  imageCount: number;
  reportCount: number;
  platforms: Platform[];
  reports: Array<{ id: string; title: string }>;
  periodStart: string;
  periodEnd: string;
};
type ReportBase = { id: string; title: string; period_start: string; period_end: string; current_published_version_id: string | null };
type Version = { id: string; version_number: number; status: string; published_at: string | null; summary: string | null; ai_summary: AiSummaryPayload | null };

async function hydrate(reports: ReportBase[]): Promise<PublishedPeriod[]> {
  const ids = reports.map((report) => report.current_published_version_id).filter((id): id is string => Boolean(id));
  if (!ids.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("report_versions")
    .select("id, version_number, status, published_at, summary, ai_summary")
    .in("id", ids).eq("status", "published").returns<Version[]>();
  if (error) throw error;
  const versions = new Map((data ?? []).map((version) => [version.id, version]));
  return reports.flatMap((report) => {
    const version = report.current_published_version_id ? versions.get(report.current_published_version_id) : null;
    return version ? [{ reportId: report.id, versionId: version.id, versionNumber: version.version_number, title: report.title, periodStart: report.period_start, periodEnd: report.period_end, publishedAt: version.published_at, summary: version.summary, aiSummary: version.ai_summary }] : [];
  });
}

export async function listPublishedPeriodsPage(clientId: string, options: { cursor?: string; direction?: "next" | "prev"; limit?: number } = {}): Promise<PublishedPeriodsPage> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const cursor = decodeCursor(options.cursor);
  const previousDirection = options.direction === "prev";
  const supabase = await createClient();
  let query = supabase.from("reports")
    .select("id, title, period_start, period_end, current_published_version_id")
    .eq("client_id", clientId).not("current_published_version_id", "is", null)
    .order("period_end", { ascending: previousDirection })
    .order("id", { ascending: previousDirection }).limit(limit + 1);
  if (cursor) {
    const operator = previousDirection ? "gt" : "lt";
    query = query.or(`period_end.${operator}.${cursor.value},and(period_end.eq.${cursor.value},id.${operator}.${cursor.id})`);
  }
  const { data, error } = await query.returns<ReportBase[]>();
  if (error) throw error;
  const raw = data ?? [];
  const hasMore = raw.length > limit;
  const selected = raw.slice(0, limit);
  if (previousDirection) selected.reverse();
  const periods = await hydrate(selected);
  const first = selected[0];
  const last = selected[selected.length - 1];
  return {
    periods,
    total: periods.length,
    previousCursor: (previousDirection ? hasMore : Boolean(cursor)) && first ? encodeCursor({ value: first.period_end, id: first.id }) : null,
    nextCursor: (previousDirection ? Boolean(cursor) : hasMore) && last ? encodeCursor({ value: last.period_end, id: last.id }) : null,
  };
}

/** Bounded history for dashboard charts. */
export async function listPublishedPeriods(clientId: string, limit = 24): Promise<PublishedPeriod[]> {
  return (await listPublishedPeriodsPage(clientId, { limit })).periods;
}

export async function loadPublishedPeriod(reportId: string, clientId: string): Promise<PublishedPeriod | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("reports")
    .select("id, title, period_start, period_end, current_published_version_id")
    .eq("id", reportId).eq("client_id", clientId).maybeSingle<ReportBase>();
  if (error) throw error;
  if (!data) return null;
  return (await hydrate([data]))[0] ?? null;
}

export async function loadPreviousPublishedPeriod(period: PublishedPeriod, clientId: string): Promise<PublishedPeriod | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("reports")
    .select("id, title, period_start, period_end, current_published_version_id")
    .eq("client_id", clientId).not("current_published_version_id", "is", null)
    .or(`period_end.lt.${period.periodEnd},and(period_end.eq.${period.periodEnd},id.lt.${period.reportId})`)
    .order("period_end", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle<ReportBase>();
  if (error) throw error;
  return data ? (await hydrate([data]))[0] ?? null : null;
}

export async function loadMetrics(versionIds: string[]): Promise<Map<string, MetricRow[]>> {
  const grouped = new Map<string, MetricRow[]>();
  if (!versionIds.length) return grouped;
  const supabase = await createClient();
  const { data, error } = await supabase.from("metrics").select("*").in("report_version_id", versionIds).order("platform", { ascending: true }).returns<MetricRow[]>();
  if (error) throw error;
  for (const id of versionIds) grouped.set(id, []);
  for (const metric of data ?? []) grouped.get(metric.report_version_id)?.push(metric);
  return grouped;
}

export async function loadPortalMetrics(versionIds: string[]): Promise<Map<string, PortalMetric[]>> {
  const grouped = new Map<string, PortalMetric[]>();
  if (!versionIds.length) return grouped;
  const supabase = await createClient();
  const { data, error } = await supabase.from("metrics")
    .select("*, insight_batches(account_id, accounts(page_name, page_id, stage))")
    .in("report_version_id", versionIds)
    .order("platform", { ascending: true })
    .returns<Array<MetricRow & {
      insight_batches: {
        account_id: string | null;
        accounts: { page_name: string | null; page_id: string | null; stage: string | null } | null;
      } | null;
    }>>();
  if (error) throw error;
  for (const id of versionIds) grouped.set(id, []);
  for (const metric of data ?? []) {
    const { insight_batches, ...row } = metric;
    grouped.get(row.report_version_id)?.push({
      ...row,
      accountId: insight_batches?.account_id ?? null,
      accountName: insight_batches?.accounts?.page_name ?? insight_batches?.accounts?.page_id ?? null,
      accountStage: insight_batches?.accounts?.stage ?? null,
    });
  }
  return grouped;
}

/** Lightweight folder summaries for client-visible screenshots. */
export async function loadPublishedAnalysisMonths(clientId: string): Promise<GalleryMonth[]> {
  const periods = await listPublishedPeriods(clientId, 100);
  if (!periods.length) return [];

  const admin = createAdminClient();
  const versionIds = periods.map((period) => period.versionId);
  const { data, error } = await admin.from("insight_batches")
    .select("report_version_id, platform, insight_images(id, storage_path, sort_order)")
    .in("report_version_id", versionIds)
    .returns<Array<{
      report_version_id: string;
      platform: Platform;
      insight_images: Array<{ id: string; storage_path: string; sort_order: number }>;
    }>>();
  if (error) throw error;

  const periodByVersion = new Map(periods.map((period) => [period.versionId, period]));
  const grouped = new Map<string, {
    coverPath: string | null;
    imageCount: number;
    platforms: Set<Platform>;
    reports: Map<string, string>;
    periodStart: string;
    periodEnd: string;
  }>();

  for (const batch of data ?? []) {
    const period = periodByVersion.get(batch.report_version_id);
    const imageCount = batch.insight_images?.length ?? 0;
    if (!period || imageCount === 0) continue;

    const month = period.periodEnd.slice(0, 7);
    const current = grouped.get(month) ?? {
      coverPath: null,
      imageCount: 0,
      platforms: new Set<Platform>(),
      reports: new Map<string, string>(),
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    };
    current.imageCount += imageCount;
    const firstImage = [...(batch.insight_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
    if (!current.coverPath && firstImage) current.coverPath = firstImage.storage_path;
    current.platforms.add(batch.platform);
    current.reports.set(period.reportId, period.title);
    if (period.periodStart < current.periodStart) current.periodStart = period.periodStart;
    if (period.periodEnd > current.periodEnd) current.periodEnd = period.periodEnd;
    grouped.set(month, current);
  }

  const coverPaths = [...grouped.values()].flatMap((value) => value.coverPath ? [value.coverPath] : []);
  const { data: signedCovers, error: signedCoverError } = coverPaths.length
    ? await admin.storage.from(INSIGHTS_BUCKET).createSignedUrls(coverPaths, 60 * 15)
    : { data: [], error: null };
  if (signedCoverError) throw signedCoverError;
  const coverUrls = new Map(coverPaths.map((path, index) => [path, signedCovers?.[index]?.signedUrl ?? null]));

  return [...grouped.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, value]) => ({
      month,
      coverUrl: value.coverPath ? coverUrls.get(value.coverPath) ?? null : null,
      imageCount: value.imageCount,
      reportCount: value.reports.size,
      platforms: PLATFORMS.filter((platform) => value.platforms.has(platform)),
      reports: [...value.reports.entries()].map(([id, title]) => ({ id, title })),
      periodStart: value.periodStart,
      periodEnd: value.periodEnd,
    }));
}

/** Client-visible source screenshots for published reports only. */
export async function loadPublishedAnalysisGallery(clientId: string, month?: string): Promise<GalleryImage[]> {
  const periods = (await listPublishedPeriods(clientId, 100))
    .filter((period) => !month || period.periodEnd.startsWith(month));
  if (!periods.length) return [];

  // The tenant-scoped period query proves ownership and publication before the
  // service client mints short-lived URLs for this client's private images.
  const admin = createAdminClient();
  const versionIds = periods.map((period) => period.versionId);
  const { data, error } = await admin.from("insight_batches")
    .select("id, report_version_id, platform, account_id, insight_images(id, storage_path, original_filename, sort_order)")
    .in("report_version_id", versionIds)
    .returns<Array<{
      id: string;
      report_version_id: string;
      platform: Platform;
      account_id: string | null;
      insight_images: Array<{ id: string; storage_path: string; original_filename: string | null; sort_order: number }>;
    }>>();
  if (error) throw error;

  const periodByVersion = new Map(periods.map((period) => [period.versionId, period]));
  const rows = (data ?? [])
    .flatMap((batch) => batch.insight_images.map((image) => ({ batch, image })))
    .sort((a, b) => {
      const periodA = periodByVersion.get(a.batch.report_version_id);
      const periodB = periodByVersion.get(b.batch.report_version_id);
      return (periodB?.periodEnd ?? "").localeCompare(periodA?.periodEnd ?? "") || a.image.sort_order - b.image.sort_order;
    });
  if (!rows.length) return [];
  const { data: signed, error: signedError } = await admin.storage.from(INSIGHTS_BUCKET)
    .createSignedUrls(rows.map(({ image }) => image.storage_path), 60 * 15);
  if (signedError) throw signedError;

  return rows.flatMap(({ batch, image }, index) => {
    const period = periodByVersion.get(batch.report_version_id);
    const url = signed?.[index]?.signedUrl;
    if (!period || !url) return [];
    return [{
      id: image.id,
      url,
      filename: image.original_filename,
      platform: batch.platform,
      accountId: batch.account_id,
      reportId: period.reportId,
      reportTitle: period.title,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    }];
  }).sort((a, b) => Date.parse(b.periodEnd) - Date.parse(a.periodEnd));
}
