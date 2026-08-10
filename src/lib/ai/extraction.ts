import {
  defaultUnitFor,
  isMetricUnit,
  normalizeMetricName,
  type MetricUnit,
} from "@/lib/analytics/normalization";
import type { Platform } from "@/types/database";
import type { ExtractedMetric, ExtractionResult } from "./schemas";

/**
 * Turning a model response into metric rows.
 *
 * This is the boundary where an AI claim becomes application data. Everything
 * here is conservative: names are folded to the canonical vocabulary, anything
 * the model was unsure about is flagged for a human, and no value is repaired,
 * defaulted, or filled in (plan §15, §16).
 */

/** Below this, a reading goes to the admin before it counts (plan §15). */
export const CONFIDENCE_REVIEW_THRESHOLD = 0.7;

export type PreparedMetric = {
  platform: Platform;
  metric_name: string;
  metric_value: number | null;
  metric_unit: MetricUnit;
  confidence: number;
  needs_review: boolean;
  note: string | null;
};

export type PreparedExtraction = {
  metrics: PreparedMetric[];
  /** Panels the model reported as illegible, shown verbatim on the review screen. */
  unreadable: string[];
  periodLabel: string | null;
  /** Entries dropped before they reached the database, with the reason. */
  discarded: Array<{ name: string; reason: string }>;
};

function reviewNote(metric: ExtractedMetric): string | null {
  if (metric.value === null) return "ai:unreadable";
  if (metric.confidence < CONFIDENCE_REVIEW_THRESHOLD) {
    return metric.literal ? `ai:low-confidence:${metric.literal}` : "ai:low-confidence";
  }
  return metric.literal ? `ai:${metric.literal}` : null;
}

/**
 * Map an extraction onto rows ready for insert.
 *
 * The batch's own platform wins over whatever the model echoed back: the model
 * is transcribing screenshots we already filed under a platform, so its opinion
 * on that is not evidence.
 */
export function prepareExtraction(
  result: ExtractionResult,
  platform: Platform
): PreparedExtraction {
  const byName = new Map<string, PreparedMetric>();
  const discarded: Array<{ name: string; reason: string }> = [];

  for (const metric of result.metrics) {
    const name = normalizeMetricName(metric.metric_name);

    if (!name) {
      discarded.push({ name: metric.metric_name, reason: "unnamed" });
      continue;
    }

    // A negative count is a misread, not a real figure. Rates and growth
    // deltas can legitimately be negative, so only counts are rejected.
    const unit: MetricUnit =
      metric.unit && isMetricUnit(metric.unit) ? metric.unit : defaultUnitFor(name);

    if (
      metric.value !== null &&
      metric.value < 0 &&
      unit === "count" &&
      !name.endsWith("_growth")
    ) {
      discarded.push({ name, reason: "negative-count" });
      continue;
    }

    const prepared: PreparedMetric = {
      platform,
      metric_name: name,
      metric_value: metric.value,
      metric_unit: unit,
      confidence: metric.confidence,
      needs_review: metric.value === null || metric.confidence < CONFIDENCE_REVIEW_THRESHOLD,
      note: reviewNote(metric),
    };

    const existing = byName.get(name);

    if (!existing) {
      byName.set(name, prepared);
      continue;
    }

    // The model listed the same metric twice — keep the reading it was surer
    // of, but never let a duplicate silently replace a real value with a null.
    const existingRank = existing.metric_value === null ? -1 : existing.confidence;
    const preparedRank = prepared.metric_value === null ? -1 : prepared.confidence;

    if (preparedRank > existingRank) {
      byName.set(name, { ...prepared, needs_review: true, note: "ai:conflicting-readings" });
    } else {
      byName.set(name, { ...existing, needs_review: true, note: "ai:conflicting-readings" });
    }

    discarded.push({ name, reason: "duplicate" });
  }

  return {
    metrics: [...byName.values()],
    unreadable: result.unreadable ?? [],
    periodLabel: result.period_label?.trim() || null,
    discarded,
  };
}

/** How much of a batch a human still has to check. Drives the review badge. */
export function reviewSummary(metrics: PreparedMetric[]): {
  total: number;
  needsReview: number;
  unreadable: number;
} {
  return {
    total: metrics.length,
    needsReview: metrics.filter((metric) => metric.needs_review).length,
    unreadable: metrics.filter((metric) => metric.metric_value === null).length,
  };
}
