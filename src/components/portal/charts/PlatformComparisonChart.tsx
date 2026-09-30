"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Eye, Heart, RadioTower, Users, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { faFacebook, faInstagram, faTiktok, faYoutube } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatCompact } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { Platform } from "@/types/database";
import { ChartFrame, ChartTooltip, PLATFORM_COLORS } from "./chart-parts";

export type PlatformBar = { platform: Platform; views: number | null; reach: number | null; engagement: number | null; followers: number | null };
const MEASURES: Array<{ key: "views" | "reach" | "engagement" | "followers"; icon: LucideIcon }> = [
  { key: "views", icon: Eye }, { key: "reach", icon: RadioTower }, { key: "engagement", icon: Heart }, { key: "followers", icon: Users },
];
const PLATFORM_ICONS = { facebook: faFacebook, instagram: faInstagram, tiktok: faTiktok, youtube: faYoutube };

export default function PlatformComparisonChart({ locale, platforms }: { locale: Locale; platforms: PlatformBar[] }) {
  const t = useTranslations("portal.charts");
  const tPlatforms = useTranslations("platforms");
  const available = MEASURES.filter(({ key }) => platforms.some((platform) => platform[key] !== null));
  const [selected, setSelected] = useState(available[0]?.key ?? "views");
  const measure = available.some(({ key }) => key === selected) ? selected : available[0]?.key ?? "views";
  const data = platforms.filter((platform) => platform[measure] !== null).map((platform) => ({ ...platform, label: tPlatforms(platform.platform), value: Number(platform[measure]) })).sort((a, b) => b.value - a.value);
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  const leader = data[0];

  const picker = (
    <div className="inline-flex shrink-0 gap-0.5 rounded-xl border border-white/[0.07] bg-black/20 p-0.5">
      {available.map(({ key, icon: Icon }) => (
        <Button
          key={key}
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setSelected(key)}
          aria-label={t(`series.${key}` as never)}
          aria-pressed={key === measure}
          title={t(`series.${key}` as never)}
          className={cn(
            "size-7 rounded-lg",
            key === measure
              ? "bg-[#e4ce91] text-[#17150f] hover:bg-[#e4ce91]/90"
              : "text-[#85837b] hover:bg-white/[0.05] hover:text-[#d6d1c6]"
          )}
        >
          <Icon className="size-3.5" strokeWidth={1.9} aria-hidden />
        </Button>
      ))}
    </div>
  );

  return (
    <ChartFrame title={t("comparisonTitle")} hint={t("comparisonHint")} action={picker} isEmpty={data.length === 0} emptyLabel={t("comparisonEmpty")} responsive={false}>
      <div className="@container/comparison min-w-0">
        <div className="grid min-h-0 min-w-0 items-center gap-3 @min-[24rem]/comparison:grid-cols-[10rem_minmax(0,1fr)] @min-[24rem]/comparison:gap-4 @min-[36rem]/comparison:grid-cols-[12rem_minmax(0,1fr)] @min-[36rem]/comparison:gap-6">
        <div className="relative mx-auto size-40 min-w-0 @min-[36rem]/comparison:size-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>{data.map((entry) => <filter key={entry.platform} id={`glow-${entry.platform}`} x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={PLATFORM_COLORS[entry.platform]} floodOpacity="0.3" /></filter>)}</defs>
              <Pie data={data} dataKey="value" nameKey="label" innerRadius="65%" outerRadius="91%" paddingAngle={4} cornerRadius={9} stroke="transparent" animationDuration={900}>
                {data.map((entry) => <Cell key={entry.platform} fill={PLATFORM_COLORS[entry.platform]} filter={`url(#glow-${entry.platform})`} />)}
              </Pie>
              <Tooltip content={<ChartTooltip locale={locale} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="max-w-24 text-[9px] font-semibold leading-tight text-[#85837b]">{t(`series.${measure}` as never)}</span>
            <strong className="mt-1 font-satoshi text-2xl tracking-[-0.05em] tabular-nums text-[#f4f0e7]">{formatCompact(total, locale)}</strong>
            {leader && <span className="mt-1 text-[9px] text-[#77766f]">{tPlatforms(leader.platform)}</span>}
          </div>
        </div>

        <ul className="grid min-w-0 gap-1.5">
          {data.map((entry) => {
            const share = total > 0 ? (entry.value / total) * 100 : 0;
            const color = PLATFORM_COLORS[entry.platform];
            return (
              <li key={entry.platform} className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 rounded-xl border border-white/[0.06] bg-white/[0.022] px-2.5 py-2 transition-colors hover:border-white/[0.11] hover:bg-white/[0.04]">
                <span className="row-span-2 flex size-7 items-center justify-center rounded-lg" style={{ color, backgroundColor: `${color}17` }}>
                  <FontAwesomeIcon icon={PLATFORM_ICONS[entry.platform]} className="size-3.5" aria-hidden />
                </span>
                <p className="min-w-0 truncate text-[11px] font-medium text-[#d8d4c9]" title={entry.label}>{entry.label}</p>
                <span className="text-end font-satoshi text-sm tabular-nums text-[#f1eee6]">{formatCompact(entry.value, locale)}</span>
                <span aria-hidden className="h-1 min-w-0 overflow-hidden rounded-full bg-white/[0.045]">
                  <span className="block h-full rounded-full" style={{ width: `${share}%`, backgroundColor: color }} />
                </span>
                <span className="text-end text-[10px] tabular-nums" style={{ color }}>{share.toFixed(0)}%</span>
              </li>
            );
          })}
        </ul>
        </div>
      </div>
    </ChartFrame>
  );
}
