import type { MetricRow } from "@/types/database";
import { sumAcrossPlatforms, weightedAverage } from "@/lib/analytics/calculations";
import { isRateMetric } from "@/lib/analytics/normalization";
import type { MetricSeries } from "@/components/portal/charts/MetricTrendChart";

/**
 * One series per metric, across periods, for the metric picker chart.
 *
 * Counts are summed across platforms; rates are weighted by views, because a
 * plain mean of per-platform percentages over-counts small platforms — the same
 * rule the KPI row uses. A period that never reported the metric contributes a
 * null point, so the line breaks instead of implying a value (plan §16).
 *
 * `periods` must arrive oldest-first; the chart draws in the order given.
 */
export function buildMetricSeries(
  periods: Array<{ label: string; metrics: MetricRow[] }>
): MetricSeries[] {
  const names = new Set<string>();
  for (const period of periods) {
    for (const metric of period.metrics) {
      if (metric.metric_value !== null) names.add(metric.metric_name);
    }
  }

  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((metricName) => ({
      metricName,
      points: periods.map((period) => ({
        label: period.label,
        value: isRateMetric(metricName)
          ? weightedAverage(period.metrics, metricName, "views")
          : sumAcrossPlatforms(period.metrics, metricName).total,
      })),
    }));
}
