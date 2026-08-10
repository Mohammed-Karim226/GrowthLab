import type { MetricRow, Platform } from "@/types/database";

/**
 * Metric normalisation.
 *
 * The AI is asked to use these canonical names, but screenshots vary wildly, so
 * aliases get folded in here. A platform-specific metric that matches nothing
 * is kept as-is rather than forced into a common bucket (plan §14).
 */

export const COMMON_METRICS = [
  "views",
  "reach",
  "impressions",
  "followers",
  "follower_growth",
  "likes",
  "comments",
  "shares",
  "saves",
  "engagement",
  "engagement_rate",
  "watch_time",
  "average_watch_time",
  "profile_visits",
  "subscribers",
  "subscriber_growth",
  "click_through_rate",
] as const;

export type CommonMetric = (typeof COMMON_METRICS)[number];

const ALIASES: Record<string, CommonMetric> = {
  video_views: "views",
  total_views: "views",
  plays: "views",
  video_plays: "views",
  accounts_reached: "reach",
  people_reached: "reach",
  unique_viewers: "reach",
  total_impressions: "impressions",
  page_followers: "followers",
  total_followers: "followers",
  new_followers: "follower_growth",
  followers_gained: "follower_growth",
  net_followers: "follower_growth",
  reactions: "likes",
  total_likes: "likes",
  bookmarks: "saves",
  total_engagement: "engagement",
  interactions: "engagement",
  accounts_engaged: "engagement",
  engagement_pct: "engagement_rate",
  total_watch_time: "watch_time",
  watch_time_hours: "watch_time",
  avg_view_duration: "average_watch_time",
  average_view_duration: "average_watch_time",
  avg_watch_time: "average_watch_time",
  new_subscribers: "subscriber_growth",
  subscribers_gained: "subscriber_growth",
  ctr: "click_through_rate",
  clickthrough_rate: "click_through_rate",
  impressions_ctr: "click_through_rate",
};

/** Fold a raw metric name to snake_case and resolve known aliases. */
export function normalizeMetricName(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[%()]/g, "")
    .replace(/[\s\-/.]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return ALIASES[slug] ?? slug;
}

export function isCommonMetric(name: string): name is CommonMetric {
  return (COMMON_METRICS as readonly string[]).includes(name);
}

/** Metrics that are rates, not counts — never summed across platforms. */
const RATE_METRICS = new Set<string>([
  "engagement_rate",
  "click_through_rate",
  "average_watch_time",
]);

export function isRateMetric(name: string): boolean {
  return RATE_METRICS.has(name);
}

/**
 * Units a metric value may carry. `metric_unit` is a text column rather than a
 * database enum, so this list is the contract every writer validates against.
 */
export const METRIC_UNITS = [
  "count",
  "percent",
  "seconds",
  "minutes",
  "hours",
  "currency",
] as const;

export type MetricUnit = (typeof METRIC_UNITS)[number];

export function isMetricUnit(value: string): value is MetricUnit {
  return (METRIC_UNITS as readonly string[]).includes(value);
}

/** Canonical unit for a metric, used when the model omits or guesses one. */
export function defaultUnitFor(name: string): MetricUnit {
  if (name === "engagement_rate" || name === "click_through_rate") return "percent";
  if (name === "watch_time" || name === "average_watch_time") return "seconds";
  return "count";
}

export type MetricLookup = Map<string, MetricRow>;

/** Index metrics by `platform:metric_name` for O(1) comparison lookups. */
export function indexMetrics(metrics: MetricRow[]): MetricLookup {
  const index: MetricLookup = new Map();
  for (const metric of metrics) {
    index.set(`${metric.platform}:${metric.metric_name}`, metric);
  }
  return index;
}

export function metricsForPlatform(metrics: MetricRow[], platform: Platform): MetricRow[] {
  return metrics.filter((metric) => metric.platform === platform);
}

/** Platforms that actually have at least one readable value. */
export function platformsPresent(metrics: MetricRow[]): Platform[] {
  const seen = new Set<Platform>();
  for (const metric of metrics) {
    if (metric.metric_value !== null) seen.add(metric.platform);
  }
  return [...seen];
}
