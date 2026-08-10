import type { MetricRow, Platform } from "@/types/database";
import { isRateMetric, metricsForPlatform } from "./normalization";

/**
 * Calculation engine.
 *
 * The application — not the AI — owns every derived number (plan §4). All
 * functions are total: missing, null, or zero-baseline inputs yield null
 * rather than NaN or Infinity, and nothing is calculated from inputs that
 * do not exist.
 */

export type GrowthResult = {
  /** Percentage change, or null when it cannot be honestly computed. */
  percent: number | null;
  /** Absolute difference, or null when either side is missing. */
  absolute: number | null;
  direction: "up" | "down" | "flat" | "unknown";
  /** True when the previous value was 0 — growth % is undefined, not infinite. */
  fromZero: boolean;
};

const UNKNOWN_GROWTH: GrowthResult = {
  percent: null,
  absolute: null,
  direction: "unknown",
  fromZero: false,
};

/**
 * growth = ((current - previous) / previous) * 100
 *
 * Guards, in order: missing input, non-finite input, and a zero baseline
 * (which would divide by zero — reported as fromZero with a null percent so
 * the UI can say "new" instead of "+∞%").
 */
export function calculateGrowth(
  current: number | null | undefined,
  previous: number | null | undefined
): GrowthResult {
  if (current === null || current === undefined) return UNKNOWN_GROWTH;
  if (previous === null || previous === undefined) return UNKNOWN_GROWTH;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return UNKNOWN_GROWTH;

  const absolute = current - previous;

  if (previous === 0) {
    return {
      percent: null,
      absolute,
      direction: absolute > 0 ? "up" : absolute < 0 ? "down" : "flat",
      fromZero: true,
    };
  }

  // Math.abs on the denominator keeps the sign meaningful for negative
  // baselines (e.g. a previous period of net follower loss).
  const percent = (absolute / Math.abs(previous)) * 100;

  if (!Number.isFinite(percent)) return UNKNOWN_GROWTH;

  return {
    percent: roundTo(percent, 1),
    absolute,
    direction: absolute > 0 ? "up" : absolute < 0 ? "down" : "flat",
    fromZero: false,
  };
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Sum a metric across platforms.
 *
 * Returns null when no platform reported the metric — a total of 0 would be a
 * fabricated claim that every platform scored zero. Rate metrics are refused
 * outright, since summing percentages is meaningless.
 */
export function sumAcrossPlatforms(
  metrics: MetricRow[],
  metricName: string
): { total: number | null; contributingPlatforms: Platform[] } {
  if (isRateMetric(metricName)) {
    return { total: null, contributingPlatforms: [] };
  }

  const contributing: Platform[] = [];
  let total = 0;
  let found = false;

  for (const metric of metrics) {
    if (metric.metric_name !== metricName) continue;
    if (metric.metric_value === null || !Number.isFinite(metric.metric_value)) continue;

    total += metric.metric_value;
    found = true;
    if (!contributing.includes(metric.platform)) contributing.push(metric.platform);
  }

  return { total: found ? roundTo(total, 2) : null, contributingPlatforms: contributing };
}

/**
 * Weighted average for rate metrics.
 *
 * Weighted by a companion volume metric where available (e.g. engagement_rate
 * weighted by views), falling back to a plain mean. An unweighted mean of
 * per-platform rates would over-count small platforms.
 */
export function weightedAverage(
  metrics: MetricRow[],
  metricName: string,
  weightMetricName: string
): number | null {
  let weightedSum = 0;
  let weightTotal = 0;
  const plainValues: number[] = [];

  const byPlatform = new Map<Platform, { value?: number; weight?: number }>();

  for (const metric of metrics) {
    if (metric.metric_value === null || !Number.isFinite(metric.metric_value)) continue;

    const entry = byPlatform.get(metric.platform) ?? {};
    if (metric.metric_name === metricName) entry.value = metric.metric_value;
    if (metric.metric_name === weightMetricName) entry.weight = metric.metric_value;
    byPlatform.set(metric.platform, entry);
  }

  for (const { value, weight } of byPlatform.values()) {
    if (value === undefined) continue;
    plainValues.push(value);
    if (weight !== undefined && weight > 0) {
      weightedSum += value * weight;
      weightTotal += weight;
    }
  }

  if (weightTotal > 0) return roundTo(weightedSum / weightTotal, 2);
  if (plainValues.length > 0) {
    return roundTo(plainValues.reduce((a, b) => a + b, 0) / plainValues.length, 2);
  }
  return null;
}

export type PlatformTotals = {
  platform: Platform;
  views: number | null;
  reach: number | null;
  followers: number | null;
  engagement: number | null;
  engagementRate: number | null;
};

function valueOf(metrics: MetricRow[], name: string): number | null {
  const match = metrics.find(
    (metric) => metric.metric_name === name && metric.metric_value !== null
  );
  return match?.metric_value ?? null;
}

export function platformTotals(metrics: MetricRow[], platform: Platform): PlatformTotals {
  const scoped = metricsForPlatform(metrics, platform);
  return {
    platform,
    views: valueOf(scoped, "views"),
    reach: valueOf(scoped, "reach"),
    followers: valueOf(scoped, "followers") ?? valueOf(scoped, "subscribers"),
    engagement: valueOf(scoped, "engagement"),
    engagementRate: valueOf(scoped, "engagement_rate"),
  };
}

export type HeadlineKpis = {
  totalViews: number | null;
  totalReach: number | null;
  totalEngagement: number | null;
  totalFollowers: number | null;
  followerGrowth: number | null;
  engagementRate: number | null;
};

/** The KPI row shown at the top of the portal. Every field may be null. */
export function headlineKpis(metrics: MetricRow[]): HeadlineKpis {
  const followersTotal = sumAcrossPlatforms(metrics, "followers").total;
  const subscribersTotal = sumAcrossPlatforms(metrics, "subscribers").total;

  const combinedFollowers =
    followersTotal === null && subscribersTotal === null
      ? null
      : roundTo((followersTotal ?? 0) + (subscribersTotal ?? 0), 2);

  const followerGain = sumAcrossPlatforms(metrics, "follower_growth").total;
  const subscriberGain = sumAcrossPlatforms(metrics, "subscriber_growth").total;

  const combinedGrowth =
    followerGain === null && subscriberGain === null
      ? null
      : roundTo((followerGain ?? 0) + (subscriberGain ?? 0), 2);

  return {
    totalViews: sumAcrossPlatforms(metrics, "views").total,
    totalReach: sumAcrossPlatforms(metrics, "reach").total,
    totalEngagement: sumAcrossPlatforms(metrics, "engagement").total,
    totalFollowers: combinedFollowers,
    followerGrowth: combinedGrowth,
    engagementRate: weightedAverage(metrics, "engagement_rate", "views"),
  };
}
