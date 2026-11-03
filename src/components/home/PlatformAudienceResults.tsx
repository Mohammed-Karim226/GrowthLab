"use client";

import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ArrowDownRight, ArrowUpRight, CalendarDays } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { calculateGrowth } from "@/lib/analytics/calculations";
import type { PlatformFollowerGrowth, PlatformFollowers } from "@/lib/testimonials/followers";
import { cn } from "@/lib/utils";
import type { Platform } from "@/types/database";

type AudiencePlatform = {
  key: Platform;
  name: string;
  icon: IconDefinition;
  color: string;
};

type PlatformAudienceResultsProps = {
  platforms: readonly AudiencePlatform[];
  growth?: PlatformFollowerGrowth;
  totals?: PlatformFollowers;
};

const platformOrder: Platform[] = ["instagram", "facebook", "tiktok", "youtube"];

export default function PlatformAudienceResults({
  platforms,
  growth,
  totals,
}: PlatformAudienceResultsProps) {
  const locale = useLocale();
  const t = useTranslations("testimonials");
  const headingId = useId();
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const exact = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const signed = new Intl.NumberFormat(locale, {
    notation: "compact", maximumFractionDigits: 1, signDisplay: "always",
  });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const orderedPlatforms = [...platforms].sort((a, b) =>
    platformOrder.indexOf(a.key) - platformOrder.indexOf(b.key),
  );

  return (
    <section
      aria-labelledby={headingId}
      className="relative mt-8 min-w-0 overflow-hidden rounded-[24px] border border-white/[0.12] bg-[#081323]/80 shadow-[0_16px_48px_rgba(0,0,0,0.18)]"
    >
      <div aria-hidden className="absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-cyan-200/50 to-transparent" />

      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-4 pt-5 sm:px-5">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
            {t("audienceResults.eyebrow")}
          </p>
          <h4 id={headingId} className="mt-1.5 font-satoshi text-lg font-semibold tracking-tight text-white">
            {t("audienceResults.title")}
          </h4>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1.5 text-[10px] font-medium text-slate-300">
          <CalendarDays className="size-3 text-cyan-200/70" aria-hidden />
          {growth
            ? t(growth.fromLaunch ? "audienceResults.launchPeriod" : "audienceResults.period", { days: growth.days })
            : t("audienceResults.latestReport")}
        </span>
      </div>

      <div className="px-3 pb-1 sm:px-4">
        <table className="w-full table-fixed border-collapse text-start">
          <caption className="sr-only">
            {growth
              ? t(growth.fromLaunch ? "audienceResults.launchCaption" : "platformFollowersPeriod", { days: growth.days })
              : t("platformFollowers")}
          </caption>
          <colgroup>
            <col className="w-[42%]" />
            <col className="w-[28%]" />
            <col className="w-[30%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-white/[0.08] text-[9px] font-medium uppercase tracking-[0.1em] text-slate-500">
              <th scope="col" className="px-1 pb-3 text-start font-medium">{t("audienceResults.platform")}</th>
              <th scope="col" className="px-1 pb-3 text-end font-medium">
                {growth?.fromLaunch
                  ? t("audienceResults.day", { days: growth.days })
                  : t("audienceResults.audience")}
              </th>
              <th scope="col" className="px-1 pb-3 text-end font-medium">{t("audienceResults.change")}</th>
            </tr>
          </thead>
          <tbody>
            {orderedPlatforms.map((platform) => {
              const current = growth ? growth.after[platform.key] : totals?.[platform.key];
              const starting = growth?.before[platform.key];
              const present = current !== null && current !== undefined && Number.isFinite(current);
              const baseline = starting !== null && starting !== undefined && Number.isFinite(starting);
              const change = calculateGrowth(current, starting);
              const TrendIcon = change.direction === "down" ? ArrowDownRight : ArrowUpRight;
              const tone = change.direction === "down" ? "text-rose-300" : change.direction === "flat" ? "text-slate-300" : "text-emerald-300";

              return (
                <tr key={platform.key} className="border-b border-white/[0.065] transition-colors last:border-0 hover:bg-white/[0.025]">
                  <th scope="row" className="py-4 pe-1 ps-1 text-start font-normal">
                    <span className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
                      <span
                        className="grid size-6 shrink-0 place-items-center rounded-lg border sm:size-8 sm:rounded-xl"
                        style={{ color: platform.color, backgroundColor: `${platform.color}12`, borderColor: `${platform.color}28` }}
                      >
                        <FontAwesomeIcon icon={platform.icon} className="size-3.5 sm:size-4" aria-hidden />
                      </span>
                      <span className="truncate text-[10px] font-medium text-slate-200 sm:text-xs">{platform.name}</span>
                    </span>
                  </th>
                  <td className="px-1 py-4 text-end align-middle">
                    <span className="block font-satoshi text-lg font-semibold leading-tight tabular-nums text-white sm:text-xl">
                      {present ? <bdi title={exact.format(current)}>{compact.format(current)}</bdi> : <span aria-label={t("followersUnavailable")}>—</span>}
                    </span>
                    <span className="mt-1 block text-[9px] leading-4 text-slate-500 sm:text-[10px]">
                      {baseline
                        ? t(growth?.fromLaunch ? "audienceResults.atLaunch" : "audienceResults.from", { count: compact.format(starting) })
                        : t(platform.key === "youtube" ? "subscribers" : "followers")}
                    </span>
                  </td>
                  <td className="px-1 py-4 text-end align-middle">
                    {change.absolute !== null ? (
                      <>
                        <span className={cn("flex items-center justify-end gap-0.5 text-xs font-semibold tabular-nums sm:gap-1 sm:text-sm", tone)}>
                          {change.direction !== "flat" && <TrendIcon className="size-3 shrink-0" aria-hidden />}
                          <bdi>{signed.format(change.absolute)}</bdi>
                        </span>
                        <span className="mt-1 block text-[9px] leading-4 tabular-nums text-slate-500 sm:text-[10px]">
                          {change.percent !== null
                            ? <bdi>{percent.format(change.percent / 100)}</bdi>
                            : t(change.absolute === 0 ? "audienceResults.noChange" : "audienceResults.newAudience")}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="block text-sm text-slate-600" aria-label={t("audienceResults.noComparison")}>—</span>
                        <span className="mt-1 block text-[9px] leading-4 text-slate-500 sm:text-[10px]">
                          {present ? t("audienceResults.totalOnly") : t("followersUnavailable")}
                        </span>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(growth?.illustrative || !growth) && (
        <p className="border-t border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[10px] leading-5 text-slate-500 sm:px-5">
          {t(growth?.illustrative ? "audienceResults.illustrative" : "followersSource")}
        </p>
      )}
    </section>
  );
}
