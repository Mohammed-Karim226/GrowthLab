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

export default function MetricsTable({
  locale,
  metrics,
}: {
  locale: Locale;
  metrics: MetricComparison[];
}) {
  const t = useTranslations("portal.detail");
  const tUi = useTranslations("portal.ui");
  const tPlatforms = useTranslations("platforms");
  const tMetrics = useTranslations("metrics");

  const grouped = PLATFORMS.map((platform) => ({
    platform,
    rows: metrics.filter((metric) => metric.platform === platform),
  })).filter((group) => group.rows.length > 0);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold tracking-[0.2em] text-[#6f6e68] uppercase">
            {tUi("dataLedger")}
          </p>
          <h2 className="mt-1 font-satoshi text-xl tracking-[-0.03em] text-[#f2efe7]">
            {t("metricsTitle")}
          </h2>
        </div>
        <p className="max-w-xl text-end text-[11px] leading-relaxed text-[#77766f]">
          {t("metricsHint")}
        </p>
      </div>

      {grouped.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/[0.08] bg-black/10 px-4 py-10 text-center text-sm text-[#77766f]">
          {t("metricsEmpty")}
        </p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {grouped.map((group) => (
            <div key={group.platform} className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <span className="size-1.5 rounded-full bg-[#d8be78]" />
                <h3 className="text-[11px] font-semibold tracking-[0.12em] text-[#aaa69d] uppercase">
                  {tPlatforms(group.platform)}
                </h3>
                <span className="ms-auto text-[9px] tabular-nums text-[#66655f]">
                  {group.rows.length}
                </span>
              </div>

              <div className="scrollbar-slim overflow-x-auto rounded-[20px] border border-white/[0.06] bg-[#10110e]">
                <Table aria-label={`${tPlatforms(group.platform)} — ${t("metricsTitle")}`}>
                  <TableHeader className="bg-white/[0.02]">
                    <TableRow className="border-white/[0.055] hover:bg-transparent">
                      <TableHead className="text-[9px] tracking-[0.1em] text-[#66655f] uppercase">{t("metric")}</TableHead>
                      <TableHead className="text-end text-[9px] tracking-[0.1em] text-[#66655f] uppercase">{t("value")}</TableHead>
                      <TableHead className="text-end text-[9px] tracking-[0.1em] text-[#66655f] uppercase">{t("previous")}</TableHead>
                      <TableHead className="text-end text-[9px] tracking-[0.1em] text-[#66655f] uppercase">{t("change")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.map((row) => {
                      const label = tMetrics.has(row.metricName as never)
                        ? tMetrics(row.metricName as never)
                        : humanizeMetricName(row.metricName);

                      return (
                        <TableRow
                          key={`${row.platform}:${row.metricName}`}
                          className="border-white/[0.045] hover:bg-white/[0.018]"
                        >
                          <TableCell className="min-w-36 text-xs font-medium text-[#b9b5ab]">
                            {label}
                          </TableCell>
                          <TableCell className="text-end text-xs tabular-nums text-[#efede6]">
                            {row.current === null
                              ? t("notReported")
                              : formatMetricValue(row.current, row.unit, locale)}
                          </TableCell>
                          <TableCell className="text-end text-xs tabular-nums text-[#77766f]">
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
