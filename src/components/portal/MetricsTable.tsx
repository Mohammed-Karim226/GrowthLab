"use client";

import { useTranslations } from "next-intl";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import GrowthBadge from "@/components/portal/GrowthBadge";
import { formatMetricValue, humanizeMetricName } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { MetricComparison } from "@/lib/analytics/comparisons";
import { PLATFORMS } from "@/types/database";

/**
 * Every number in the period, grouped by platform.
 *
 * These are the reviewed values an admin signed off before publishing — the
 * screenshots they came from stay on the admin side (plan §12).
 */
export default function MetricsTable({
  locale,
  metrics,
}: {
  locale: Locale;
  metrics: MetricComparison[];
}) {
  const t = useTranslations("portal.detail");
  const tPlatforms = useTranslations("platforms");
  const tMetrics = useTranslations("metrics");

  const grouped = PLATFORMS.map((platform) => ({
    platform,
    rows: metrics.filter((metric) => metric.platform === platform),
  })).filter((group) => group.rows.length > 0);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-satoshi text-base text-white">{t("metricsTitle")}</h2>
        <p className="text-xs text-slate-400">{t("metricsHint")}</p>
      </div>

      {grouped.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">
          {t("metricsEmpty")}
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.platform} className="space-y-2">
              <h3 className="text-sm font-medium text-slate-300">{tPlatforms(group.platform)}</h3>

              <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
                <Table aria-label={`${tPlatforms(group.platform)} — ${t("metricsTitle")}`}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("metric")}</TableHead>
                      <TableHead className="text-end">{t("value")}</TableHead>
                      <TableHead className="text-end">{t("previous")}</TableHead>
                      <TableHead className="text-end">{t("change")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.map((row) => {
                      const label = tMetrics.has(row.metricName as never)
                        ? tMetrics(row.metricName as never)
                        : humanizeMetricName(row.metricName);

                      return (
                        <TableRow key={`${row.platform}:${row.metricName}`}>
                          <TableCell className="text-slate-200">{label}</TableCell>
                          <TableCell className="text-end tabular-nums text-slate-100">
                            {row.current === null
                              ? t("notReported")
                              : formatMetricValue(row.current, row.unit, locale)}
                          </TableCell>
                          <TableCell className="text-end tabular-nums text-slate-400">
                            {row.previous === null
                              ? t("notReported")
                              : formatMetricValue(row.previous, row.unit, locale)}
                          </TableCell>
                          <TableCell className="text-end">
                            <GrowthBadge locale={locale} growth={row.growth} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
