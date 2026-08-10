import "server-only";

import { comparePeriods, type PeriodComparison } from "@/lib/analytics/comparisons";
import type { MetricRow, Platform } from "@/types/database";

/**
 * The payload handed to the interpretation prompt.
 *
 * Only calculated figures cross this line — no raw model output, no
 * screenshots, no unreviewed values. The model explains these numbers and may
 * not produce any others (plan §4, §21).
 */

export type InterpretationPayload = {
  totals: {
    views: number | null;
    reach: number | null;
    engagement: number | null;
    followers: number | null;
    follower_growth: number | null;
    engagement_rate: number | null;
  };
  change_vs_previous: Record<string, string | null>;
  platforms: Array<{
    platform: Platform;
    views: number | null;
    reach: number | null;
    followers: number | null;
    engagement: number | null;
    engagement_rate: number | null;
    views_change: string | null;
  }>;
  platforms_without_data: Platform[];
  notable_metrics: Array<{ platform: Platform; metric: string; value: number; unit: string }>;
};

/**
 * Render a growth result as text.
 *
 * A percentage the calculation engine refused to compute must not reappear as a
 * number here. "new" means the baseline was zero; null means unknowable.
 */
function changeLabel(growth: { percent: number | null; fromZero: boolean }): string | null {
  if (growth.fromZero) return "new (no prior baseline)";
  if (growth.percent === null) return null;
  const sign = growth.percent > 0 ? "+" : "";
  return `${sign}${growth.percent}%`;
}

/** Metrics worth mentioning that the KPI row does not already carry. */
function notableMetrics(metrics: MetricRow[]) {
  const covered = new Set([
    "views",
    "reach",
    "engagement",
    "followers",
    "follower_growth",
    "engagement_rate",
  ]);

  return metrics
    .filter(
      (metric) =>
        metric.metric_value !== null && !covered.has(metric.metric_name) && !metric.needs_review
    )
    .slice(0, 24)
    .map((metric) => ({
      platform: metric.platform,
      metric: metric.metric_name,
      value: metric.metric_value as number,
      unit: metric.metric_unit,
    }));
}

export function buildInterpretationPayload(
  comparison: PeriodComparison,
  currentMetrics: MetricRow[],
  allPlatforms: readonly Platform[]
): InterpretationPayload {
  const covered = new Set(comparison.platforms.map((entry) => entry.platform));

  return {
    totals: {
      views: comparison.current.totalViews,
      reach: comparison.current.totalReach,
      engagement: comparison.current.totalEngagement,
      followers: comparison.current.totalFollowers,
      follower_growth: comparison.current.followerGrowth,
      engagement_rate: comparison.current.engagementRate,
    },
    change_vs_previous: comparison.hasPrevious
      ? {
          views: changeLabel(comparison.kpiGrowth.totalViews),
          reach: changeLabel(comparison.kpiGrowth.totalReach),
          engagement: changeLabel(comparison.kpiGrowth.totalEngagement),
          followers: changeLabel(comparison.kpiGrowth.totalFollowers),
          engagement_rate: changeLabel(comparison.kpiGrowth.engagementRate),
        }
      : {},
    platforms: comparison.platforms.map((entry) => ({
      platform: entry.platform,
      views: entry.current.views,
      reach: entry.current.reach,
      followers: entry.current.followers,
      engagement: entry.current.engagement,
      engagement_rate: entry.current.engagementRate,
      views_change: changeLabel(entry.viewsGrowth),
    })),
    platforms_without_data: allPlatforms.filter((platform) => !covered.has(platform)),
    notable_metrics: notableMetrics(currentMetrics),
  };
}

export { comparePeriods };
