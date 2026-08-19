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
    <div className="flex min-w-max gap-1 rounded-full border border-white/[0.07] bg-black/20 p-1">
      {available.map(({ key, icon: Icon }) => <Button key={key} type="button" variant="ghost" size="icon-sm" onClick={() => setSelected(key)} aria-label={t(`series.${key}` as never)} aria-pressed={key === measure} className={cn("rounded-full", key === measure ? "bg-[#e4ce91] text-[#17150f] shadow-[0_8px_22px_rgba(216,190,120,0.2)] hover:bg-[#e4ce91]/90" : "text-[#6f6e68] hover:bg-white/[0.05] hover:text-[#d6d1c6]")}><Icon className="size-3.5" strokeWidth={1.9} aria-hidden /></Button>)}
    </div>
  );

  return (
    <ChartFrame title={t("comparisonTitle")} hint={t("comparisonHint")} action={picker} isEmpty={data.length === 0} emptyLabel={t("comparisonEmpty")} responsive={false}>
      <div className="grid min-h-0 items-center gap-4 sm:gap-5 lg:grid-cols-[minmax(280px,0.85fr)_minmax(300px,1.15fr)]">
        <div className="relative mx-auto size-[210px] min-w-0 sm:size-[270px]">
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
            <span className="text-[9px] font-semibold tracking-[0.16em] text-[#66655f] uppercase">{t(`series.${measure}` as never)}</span>
            <strong className="mt-1 font-satoshi text-3xl tracking-[-0.05em] text-[#f4f0e7]">{formatCompact(total, locale)}</strong>
            {leader && <span className="mt-1 text-[9px] text-[#77766f]">{tPlatforms(leader.platform)}</span>}
          </div>
        </div>

        <div className="grid min-w-0 gap-2.5 sm:grid-cols-2">
          {data.map((entry, index) => {
            const share = total > 0 ? (entry.value / total) * 100 : 0;
            const color = PLATFORM_COLORS[entry.platform];
            return <article key={entry.platform} className="group relative min-w-0 overflow-hidden rounded-[18px] border border-white/[0.06] bg-white/[0.022] p-3.5 transition-all hover:-translate-y-0.5 hover:border-white/[0.11] hover:bg-white/[0.04] sm:rounded-[20px] sm:p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-[14px]" style={{ color, backgroundColor: `${color}17` }}><FontAwesomeIcon icon={PLATFORM_ICONS[entry.platform]} className="size-[17px]" aria-hidden /></span>
                <div className="min-w-0"><p className="truncate text-xs font-medium text-[#d8d4c9]">{entry.label}</p><p className="mt-0.5 text-[9px] text-[#62615b]">#{index + 1}</p></div>
                <span className="ms-auto font-satoshi text-lg tabular-nums text-[#f1eee6]">{formatCompact(entry.value, locale)}</span>
              </div>
              <div className="mt-4 flex items-center gap-3"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.045]"><span className="block h-full rounded-full" style={{ width: `${share}%`, backgroundColor: color, boxShadow: `0 0 14px ${color}55` }} /></span><span className="w-9 text-end text-[10px] font-semibold tabular-nums" style={{ color }}>{share.toFixed(0)}%</span></div>
            </article>;
          })}
        </div>
      </div>
    </ChartFrame>
  );
}
