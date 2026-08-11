"use client";

import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";

import type { Locale } from "@/lib/i18n";
import { isRtl } from "./chart-parts";
import type { Platform } from "@/types/database";
import {
  ChartFrame,
  ChartTooltip,
  PLATFORM_COLORS,
  Tooltip,
  AXIS_STYLE,
  chartGrid,
  tooltipCursor,
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
    MEASURES.find((candidate) => platforms.some((platform) => platform[candidate] !== null)) ?? null;

  const data = measure
    ? platforms
        .filter((platform) => platform[measure] !== null)
        .map((platform) => ({
          label: tPlatforms(platform.platform),
          platform: platform.platform,
          value: platform[measure],
        }))
        .sort((a, b) => Number(b.value) - Number(a.value))
    : [];

  return (
    <ChartFrame
      title={t("comparisonTitle")}
      hint={t("comparisonHint")}
      isEmpty={data.length === 0 || measure === null}
      emptyLabel={t("comparisonEmpty")}
    >
      <BarChart layout="vertical" data={data} margin={{ top: 8, right: isRtl(locale) ? 20 : 52, bottom: 0, left: isRtl(locale) ? 52 : 20 }} barCategoryGap="24%">
        <defs>
          {data.map((entry) => {
            const color = PLATFORM_COLORS[entry.platform] ?? "#d8be78";
            return (
              <linearGradient
                key={entry.platform}
                id={`platform-${entry.platform}`}
                x1={isRtl(locale) ? "100%" : "0%"}
                y1="0%"
                x2={isRtl(locale) ? "0%" : "100%"}
                y2="0%"
              >
                <stop offset="0%" stopColor={color} stopOpacity={0.38} />
                <stop offset="100%" stopColor={color} stopOpacity={1} />
              </linearGradient>
            );
          })}
        </defs>
        <XAxis
          type="number"
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          orientation="bottom"
          reversed={isRtl(locale)}
          tickFormatter={(value: number) => value.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", { notation: "compact" })}
        />
        <YAxis
          type="category"
          dataKey="label"
          orientation={isRtl(locale) ? "right" : "left"}
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={76}
          reversed={isRtl(locale)}
        />
        {chartGrid()}
        <Tooltip cursor={tooltipCursor()} content={<ChartTooltip locale={locale} />} />
        <Bar dataKey="value" name={measure ? t(`series.${measure}` as never) : ""} radius={[9, 9, 9, 9]} background={{ fill: "rgba(255,255,255,0.025)", radius: 9 }} maxBarSize={30} isAnimationActive animationDuration={900} animationEasing="ease-out">
          {data.map((entry) => <Cell key={entry.platform} fill={`url(#platform-${entry.platform})`} />)}
          <LabelList dataKey="value" position={isRtl(locale) ? "left" : "right"} formatter={(value: number) => value.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", { notation: "compact" })} fill="#c9c5ba" fontSize={10} />
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}
