import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AiSummaryPayload, MetricRow } from "@/types/database";

/**
 * Every read the client portal performs.
 *
 * Two independent things make a row visible here, and both must hold:
 *   1. these queries filter on the caller's own `client_id`, resolved from their
 *      session profile — never from a URL parameter;
 *   2. RLS re-checks the same ownership in the database, so a mistake in this
 *      file cannot leak another tenant's data (plan §43, §44).
 *
 * Only *published* versions are read. A draft, an approved-but-unpublished
 * version, and an archived one are all invisible to a client, as are raw
 * screenshots, batches and AI responses.
 */

export type PublishedPeriod = {
  reportId: string;
  versionId: string;
  versionNumber: number;
  title: string;
  periodStart: string;
  periodEnd: string;
  publishedAt: string | null;
  summary: string | null;
  aiSummary: AiSummaryPayload | null;
};

type PublishedRow = {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  current_published_version_id: string | null;
  report_versions: Array<{
    id: string;
    version_number: number;
    status: string;
    published_at: string | null;
    summary: string | null;
    ai_summary: AiSummaryPayload | null;
  }>;
};

/**
 * The report's live published version, or null.
 *
 * The join can return several versions, so the pointer decides which one is
 * current; status is re-checked so a stale pointer cannot surface an archived
 * version.
 */
function publishedVersionOf(report: PublishedRow) {
  if (!report.current_published_version_id) return null;

  const version = report.report_versions.find(
    (candidate) => candidate.id === report.current_published_version_id
  );

  return version && version.status === "published" ? version : null;
}

function toPeriod(report: PublishedRow, version: NonNullable<ReturnType<typeof publishedVersionOf>>) {
  return {
    reportId: report.id,
    versionId: version.id,
    versionNumber: version.version_number,
    title: report.title,
    periodStart: report.period_start,
    periodEnd: report.period_end,
    publishedAt: version.published_at,
    summary: version.summary,
    aiSummary: version.ai_summary,
  } satisfies PublishedPeriod;
}

// The FK is named explicitly because two foreign keys connect these tables:
// report_versions.report_id -> reports.id (this one, the children) and
// reports.current_published_version_id -> report_versions.id (the pointer to
// the live one). Without the hint PostgREST cannot choose and fails PGRST201.
const PUBLISHED_SELECT =
  "id, title, period_start, period_end, current_published_version_id, " +
  "report_versions!report_versions_report_id_fkey(id, version_number, status, published_at, summary, ai_summary)";

/**
 * Published periods for one client, newest first.
 *
 * Ordered by `period_end` rather than `published_at`: a late-published report
 * still belongs in its own place in the timeline.
 */
export async function listPublishedPeriods(clientId: string): Promise<PublishedPeriod[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reports")
    .select(PUBLISHED_SELECT)
    .eq("client_id", clientId)
    .not("current_published_version_id", "is", null)
    .order("period_end", { ascending: false })
    .returns<PublishedRow[]>();

  if (error) throw error;

  const periods: PublishedPeriod[] = [];

  for (const report of data ?? []) {
    const version = publishedVersionOf(report);
    if (version) periods.push(toPeriod(report, version));
  }

  return periods;
}

/** One report, but only if it is published and belongs to this client. */
export async function loadPublishedPeriod(
  reportId: string,
  clientId: string
): Promise<PublishedPeriod | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reports")
    .select(PUBLISHED_SELECT)
    // The client id is part of the query, not an afterthought check: an id from
    // the URL never widens the result set.
    .eq("id", reportId)
    .eq("client_id", clientId)
    .maybeSingle<PublishedRow>();

  if (error) throw error;
  if (!data) return null;

  const version = publishedVersionOf(data);
  return version ? toPeriod(data, version) : null;
}

/**
 * Metrics for published versions.
 *
 * `needs_review` rows cannot appear here: a version only becomes publishable
 * once every metric has been signed off (plan §30, §33).
 */
export async function loadMetrics(versionIds: string[]): Promise<Map<string, MetricRow[]>> {
  const grouped = new Map<string, MetricRow[]>();
  if (versionIds.length === 0) return grouped;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("metrics")
    .select("*")
    .in("report_version_id", versionIds)
    .order("platform", { ascending: true })
    .returns<MetricRow[]>();

  if (error) throw error;

  for (const versionId of versionIds) grouped.set(versionId, []);
  for (const metric of data ?? []) {
    grouped.get(metric.report_version_id)?.push(metric);
  }

  return grouped;
}
