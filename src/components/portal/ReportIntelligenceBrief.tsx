"use client";

import { Activity, BadgeCheck, BrainCircuit, Crown, ScanSearch, Sparkles, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { faFacebook, faInstagram, faTiktok, faYoutube } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { formatCompact, formatPercent, formatSignedPercent } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { PeriodComparison } from "@/lib/analytics/comparisons";

const PLATFORM_ICONS = { facebook: faFacebook, instagram: faInstagram, tiktok: faTiktok, youtube: faYoutube };
const PLATFORM_COLORS = { facebook: "#7299ff", instagram: "#f071ac", tiktok: "#59e0d3", youtube: "#ff7373" };

export default function ReportIntelligenceBrief({ locale, comparison }: { locale: Locale; comparison: PeriodComparison }) {
  const t = useTranslations("portal.intelligence");
  const tKpi = useTranslations("portal.kpi");
  const tPlatforms = useTranslations("platforms");

  const leaderMetric = (["views", "engagement", "reach", "followers"] as const).find((key) =>
    comparison.platforms.some((platform) => platform.current[key] !== null)
  );
  const leader = leaderMetric
    ? [...comparison.platforms].filter((platform) => platform.current[leaderMetric] !== null).sort((a, b) => Number(b.current[leaderMetric]) - Number(a.current[leaderMetric]))[0]
    : undefined;

  const growthSignals = [
    { key: "totalViews", growth: comparison.kpiGrowth.totalViews },
    { key: "totalReach", growth: comparison.kpiGrowth.totalReach },
    { key: "totalEngagement", growth: comparison.kpiGrowth.totalEngagement },
    { key: "totalFollowers", growth: comparison.kpiGrowth.totalFollowers },
    { key: "engagementRate", growth: comparison.kpiGrowth.engagementRate },
  ].filter((signal) => signal.growth.percent !== null).sort((a, b) => Math.abs(b.growth.percent ?? 0) - Math.abs(a.growth.percent ?? 0));
  const strongest = growthSignals[0];
  const positiveSignal = growthSignals
    .filter((signal) => (signal.growth.percent ?? 0) > 0)
    .sort((a, b) => (b.growth.percent ?? 0) - (a.growth.percent ?? 0))[0];
  const negativeSignal = growthSignals
    .filter((signal) => (signal.growth.percent ?? 0) < 0)
    .sort((a, b) => (a.growth.percent ?? 0) - (b.growth.percent ?? 0))[0];

  const metricLabel = (key: string) => tKpi(key as never);

  const headline = comparison.current.engagementRate !== null
    ? { label: tKpi("engagementRate"), value: formatPercent(comparison.current.engagementRate, locale) }
    : comparison.current.totalViews !== null
      ? { label: tKpi("totalViews"), value: formatCompact(comparison.current.totalViews, locale) }
      : comparison.current.totalReach !== null
        ? { label: tKpi("totalReach"), value: formatCompact(comparison.current.totalReach, locale) }
        : null;

  return (
    <section className="portal-intelligence-stage portal-glass-panel relative min-w-0 overflow-hidden rounded-[26px] border border-white/[0.15] p-4 sm:rounded-[36px] sm:p-7 lg:p-8">
      <div aria-hidden className="absolute -end-24 -top-28 size-80 rounded-full bg-[#7c9cff]/15 blur-[100px]" />
      <div aria-hidden className="absolute -bottom-36 start-1/4 size-72 rounded-full bg-[#55e0c1]/10 blur-[110px]" />
      <div className="relative flex flex-col justify-between gap-5 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
          <span className="portal-intelligence-orb relative flex size-12 shrink-0 items-center justify-center rounded-[18px] border border-white/[0.2] text-[#f1dc97] sm:size-14 sm:rounded-[20px]">
            <BrainCircuit className="size-6" strokeWidth={1.55} aria-hidden />
            <span className="absolute -end-1 -top-1 flex size-5 items-center justify-center rounded-full border border-[#f3dc91]/30 bg-[#171829] text-[#f3dc91]"><Sparkles className="size-2.5" aria-hidden /></span>
          </span>
          <div>
            <p className="flex items-center gap-2 text-[9px] font-semibold tracking-[0.22em] text-[#d9c37f] uppercase"><Crown className="size-3.5" aria-hidden />{t("eyebrow")}</p>
            <h2 className="mt-1 font-satoshi text-xl leading-tight tracking-[-0.04em] text-[#f5f3ee] sm:text-3xl">{t("title")}</h2>
            <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-[#8e96aa]">{t("hint")}</p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#5ce0bd]/15 bg-[#5ce0bd]/[0.07] px-3 py-2 text-[9px] font-semibold tracking-[0.13em] text-[#7de3c7] uppercase"><BadgeCheck className="size-3.5" aria-hidden />{t("verified")}</span>
      </div>

      <div className="relative mt-5 grid gap-3 lg:grid-cols-[1.25fr_.85fr_.85fr]">
        <article className="portal-intelligence-feature relative min-h-[210px] min-w-0 overflow-hidden rounded-[22px] border border-white/[0.12] p-4 sm:min-h-[230px] sm:rounded-[28px] sm:p-6">
          <div className="relative z-10 flex h-full flex-col justify-between gap-10">
            <div className="flex items-start justify-between gap-4">
              <span className="flex size-12 items-center justify-center rounded-[17px] border border-[#f1d98a]/20 bg-[#f1d98a]/10 text-[#efd78a] shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_15px_35px_rgba(0,0,0,.2)]"><Trophy className="size-5" strokeWidth={1.65} aria-hidden /></span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[8px] font-semibold tracking-[0.14em] text-[#858da0] uppercase">{t("leadingChannel")}</span>
            </div>
            {leader && leaderMetric ? <div>
              <div className="flex min-w-0 items-end gap-3">
                <span className="flex size-12 items-center justify-center rounded-2xl" style={{ color: PLATFORM_COLORS[leader.platform], backgroundColor: `${PLATFORM_COLORS[leader.platform]}18` }}><FontAwesomeIcon icon={PLATFORM_ICONS[leader.platform]} className="size-5" aria-hidden /></span>
                <div><p className="font-satoshi text-2xl tracking-[-0.04em] text-white">{tPlatforms(leader.platform)}</p><p className="mt-1 text-[10px] text-[#81899b]">{t("leadsIn", { metric: tKpi(leaderMetric === "views" ? "totalViews" : leaderMetric === "reach" ? "totalReach" : leaderMetric === "engagement" ? "totalEngagement" : "totalFollowers") })}</p></div>
              </div>
              <p className="mt-5 font-satoshi text-3xl tracking-[-0.055em] tabular-nums text-[#f5f2eb] sm:text-4xl">{formatCompact(leader.current[leaderMetric], locale)}</p>
            </div> : <p className="text-sm text-[#7e8698]">{t("unavailable")}</p>}
          </div>
        </article>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <article className="portal-intelligence-tile min-w-0 rounded-[20px] border border-white/[0.11] p-4 sm:rounded-[24px] sm:p-5">
            <div className="flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-[15px] border border-[#77a0ff]/20 bg-[#77a0ff]/10 text-[#9ab6ff]"><Activity className="size-[18px]" strokeWidth={1.7} aria-hidden /></span><span className="text-[8px] font-semibold tracking-[0.13em] text-[#747d91] uppercase">{t("strongestMovement")}</span></div>
            {strongest ? <><p className="mt-5 text-[10px] text-[#8b93a5]">{tKpi(strongest.key as never)}</p><p dir="ltr" className="mt-1 font-satoshi text-3xl tracking-[-0.05em] tabular-nums text-white">{formatSignedPercent(strongest.growth.percent, locale)}</p></> : <p className="mt-5 text-sm text-[#7e8698]">{t("noComparison")}</p>}
          </article>
          <article className="portal-intelligence-tile min-w-0 rounded-[20px] border border-white/[0.11] p-4 sm:rounded-[24px] sm:p-5">
            <div className="flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-[15px] border border-[#55e0c1]/20 bg-[#55e0c1]/10 text-[#72e4c9]"><ScanSearch className="size-[18px]" strokeWidth={1.7} aria-hidden /></span><span className="text-[8px] font-semibold tracking-[0.13em] text-[#747d91] uppercase">{t("coverage")}</span></div>
            <p className="mt-5 font-satoshi text-3xl tracking-[-0.05em] tabular-nums text-white">{comparison.metrics.length}</p><p className="mt-1 text-[10px] text-[#858da0]">{t("coverageValue", { platforms: comparison.platforms.length })}</p>
          </article>
        </div>

        <article className="portal-intelligence-signal relative min-w-0 overflow-hidden rounded-[22px] border border-white/[0.12] p-4 sm:rounded-[28px] sm:p-6">
          <div aria-hidden className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#e6cf84] to-transparent" />
          <div className="flex items-center justify-between"><span className="flex size-11 items-center justify-center rounded-[16px] border border-[#e6cf84]/20 bg-[#e6cf84]/10 text-[#ecd78f]"><Sparkles className="size-5" strokeWidth={1.65} aria-hidden /></span><Crown className="size-4 text-[#d6be74]/60" aria-hidden /></div>
          <p className="mt-8 text-[9px] font-semibold tracking-[0.16em] text-[#777f92] uppercase">{t("headlineSignal")}</p>
          {headline ? <><p className="mt-2 break-words font-satoshi text-3xl tracking-[-0.06em] tabular-nums text-[#fffaf0] sm:text-4xl">{headline.value}</p><p className="mt-2 text-xs text-[#9aa1b1]">{headline.label}</p></> : <p className="mt-4 text-sm text-[#7e8698]">{t("unavailable")}</p>}
          <div className="mt-8 flex items-center gap-2 text-[9px] text-[#6f778b]"><BadgeCheck className="size-3.5 text-[#65dbbd]" aria-hidden />{t("sourceNote")}</div>
        </article>
      </div>

      <article className="relative mt-3 overflow-hidden rounded-[22px] border border-[#d8be78]/20 bg-[#d8be78]/[0.065] p-4 sm:p-5">
        <div aria-hidden className="absolute -end-12 -top-12 size-32 rounded-full bg-[#d8be78]/10 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] border border-[#d8be78]/25 bg-[#d8be78]/10 text-[#ead48d]"><Sparkles className="size-[18px]" aria-hidden /></span>
          <div className="min-w-0">
            <p className="text-[9px] font-semibold tracking-[0.15em] text-[#ead48d] uppercase">{t("outlookTitle")}</p>
            <p className="mt-2 text-sm leading-relaxed text-[#e4ded0]">
              {negativeSignal
                ? t("outlookRecovery", { metric: metricLabel(negativeSignal.key) })
                : positiveSignal
                  ? t("outlookMomentum", { metric: metricLabel(positiveSignal.key) })
                  : t("outlookFoundation")}
            </p>
          </div>
        </div>
      </article>
    </section>
  );
}
