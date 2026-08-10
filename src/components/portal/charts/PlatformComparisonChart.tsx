"use client";

import { Bar, BarChart, Cell } from "recharts";
import { useTranslations } from "next-intl";

import type { Locale } from "@/lib/i18n";
import type { Platform } from "@/types/database";
import {
  ChartFrame,
  ChartTooltip,
  PLATFORM_COLORS,
  Tooltip,
  categoryAxis,
  chartGrid,
  tooltipCursor,
  valueAxis,
} from "./chart-parts";

export type PlatformBar = {
  platform: Platform;
  views: number | null;
  reach: number | null;
  engagement: number | null;
  followers: number | null;
};

const MEASURES = ["views", "reach", "engagement", "followers"] as const;
type Measure = (typeof MEASURES)[number];

/**
 * How each platform contributed this period.
 *
 * The bar measure falls back to whichever of views → reach → engagement →
 * followers the period actually reported, so the chart stays honest when a
 * platform's insights screen did not show views at all.
 */
export default function PlatformComparisonChart({
  locale,
  platforms,
}: {
  locale: Locale;
  platforms: PlatformBar[];
}) {
  const t = useTranslations("portal.charts");
  const tPlatforms = useTranslations("platforms");

  const measure: Measure | null =
    MEASURES.find((candidate) =>
      platforms.some((platform) => platform[candidate] !== null)
    ) ?? null;

  const data = measure
    ? platforms
        .filter((platform) => platform[measure] !== null)
        .map((platform) => ({
          label: tPlatforms(platform.platform),
          platform: platform.platform,
          value: platform[measure],
        }))
    : [];

  return (
    <ChartFrame
      title={t("comparisonTitle")}
      hint={t("comparisonHint")}
      isEmpty={data.length === 0 || measure === null}
      emptyLabel={t("comparisonEmpty")}
    >
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        {chartGrid()}
        {categoryAxis(locale)}
        {valueAxis(locale)}
        <Tooltip cursor={tooltipCursor()} content={<ChartTooltip locale={locale} />} />
        <Bar
          dataKey="value"
          name={measure ? t(`series.${measure}` as never) : ""}
          radius={[6, 6, 0, 0]}
          maxBarSize={64}
          isAnimationActive={false}
        >
          {data.map((entry) => (
            <Cell key={entry.platform} fill={PLATFORM_COLORS[entry.platform] ?? "#7c8cff"} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}
