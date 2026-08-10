import type { MetricRow, Platform } from "@/types/database";
import { PLATFORMS } from "@/types/database";
import {
  calculateGrowth,
  headlineKpis,
  platformTotals,
  type GrowthResult,
  type HeadlineKpis,
  type PlatformTotals,
} from "./calculations";
import { indexMetrics, platformsPresent } from "./normalization";

/**
 * Period-over-period comparison.
 *
 * Both sides are already-approved metric sets; nothing here calls the AI. A
 * comparison is only produced when both periods actually carry the metric,
 * so the UI never shows growth against data that does not exist (plan §22).
 */

export type MetricComparison = {
  platform: Platform;
  metricName: string;
  unit: string;
  current: number | null;
  previous: number | null;
  growth: GrowthResult;
};

export type PlatformComparison = {
  platform: Platform;
  current: PlatformTotals;
  previous: PlatformTotals | null;
  viewsGrowth: GrowthResult;
  followersGrowth: GrowthResult;
  engagementGrowth: GrowthResult;
};

export type PeriodComparison = {
  hasPrevious: boolean;
  current: HeadlineKpis;
  previous: HeadlineKpis | null;
  kpiGrowth: {
    totalViews: GrowthResult;
    totalReach: GrowthResult;
    totalEngagement: GrowthResult;
    totalFollowers: GrowthResult;
    engagementRate: GrowthResult;
  };
  platforms: PlatformComparison[];
  metrics: MetricComparison[];
};

export function comparePeriods(
  currentMetrics: MetricRow[],
  previousMetrics: MetricRow[] | null
): PeriodComparison {
  const current = headlineKpis(currentMetrics);
  const hasPrevious = Boolean(previousMetrics && previousMetrics.length > 0);
  const previous = hasPrevious ? headlineKpis(previousMetrics!) : null;

  const previousIndex = indexMetrics(previousMetrics ?? []);

  const metricComparisons: MetricComparison[] = currentMetrics.map((metric) => {
    const counterpart = previousIndex.get(`${metric.platform}:${metric.metric_name}`);
    return {
      platform: metric.platform,
      metricName: metric.metric_name,
      unit: metric.metric_unit,
      current: metric.metric_value,
      previous: counterpart?.metric_value ?? null,
      growth: calculateGrowth(metric.metric_value, counterpart?.metric_value ?? null),
    };
  });

  const activePlatforms = platformsPresent(currentMetrics);

  const platformComparisons: PlatformComparison[] = PLATFORMS.filter((platform) =>
    activePlatforms.includes(platform)
  ).map((platform) => {
    const currentTotals = platformTotals(currentMetrics, platform);
    const previousTotals = hasPrevious ? platformTotals(previousMetrics!, platform) : null;

    return {
      platform,
      current: currentTotals,
      previous: previousTotals,
      viewsGrowth: calculateGrowth(currentTotals.views, previousTotals?.views ?? null),
      followersGrowth: calculateGrowth(currentTotals.followers, previousTotals?.followers ?? null),
      engagementGrowth: calculateGrowth(
        currentTotals.engagement,
        previousTotals?.engagement ?? null
      ),
    };
  });

  return {
    hasPrevious,
    current,
    previous,
    kpiGrowth: {
      totalViews: calculateGrowth(current.totalViews, previous?.totalViews ?? null),
      totalReach: calculateGrowth(current.totalReach, previous?.totalReach ?? null),
      totalEngagement: calculateGrowth(current.totalEngagement, previous?.totalEngagement ?? null),
      totalFollowers: calculateGrowth(current.totalFollowers, previous?.totalFollowers ?? null),
      engagementRate: calculateGrowth(current.engagementRate, previous?.engagementRate ?? null),
    },
    platforms: platformComparisons,
    metrics: metricComparisons,
  };
}

export type TrendPoint = {
  reportId: string;
  versionId: string;
  label: string;
  periodEnd: string;
  views: number | null;
  reach: number | null;
  engagement: number | null;
  followers: number | null;
};

/**
 * Historical series for the trend chart.
 *
 * Callers pass already-published periods only. Points are sorted oldest-first
 * so a line chart reads left-to-right in LTR; the chart component reverses for
 * RTL rather than the data layer doing it.
 */
export function buildTrendSeries(
  periods: Array<{
    reportId: string;
    versionId: string;
    title: string;
    periodEnd: string;
    metrics: MetricRow[];
  }>
): TrendPoint[] {
  return periods
    .map((period) => {
      const kpis = headlineKpis(period.metrics);
      return {
        reportId: period.reportId,
        versionId: period.versionId,
        label: period.title,
        periodEnd: period.periodEnd,
        views: kpis.totalViews,
        reach: kpis.totalReach,
        engagement: kpis.totalEngagement,
        followers: kpis.totalFollowers,
      };
    })
    .sort((a, b) => Date.parse(a.periodEnd) - Date.parse(b.periodEnd));
}

/** Rank platforms by a metric, ignoring those with no readable value. */
export function rankPlatformsBy(
  comparisons: PlatformComparison[],
  key: "views" | "reach" | "followers" | "engagement"
): PlatformComparison[] {
  return comparisons
    .filter((comparison) => comparison.current[key] !== null)
    .sort((a, b) => (b.current[key] ?? 0) - (a.current[key] ?? 0));
}
