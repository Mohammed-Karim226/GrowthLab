import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight, FolderOpen, Images } from "lucide-react";

import { formatDateRange } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { GalleryMonth } from "@/lib/portal/data";
import type { Platform } from "@/types/database";

const FOLDER_ACCENTS = ["#39a99c", "#e7b64e", "#df913b"] as const;
const PLATFORM_ORDER: Platform[] = ["facebook", "instagram", "tiktok", "youtube"];

function FolderArtwork({ number }: { number: number }) {
  return (
    <svg
      viewBox="0 0 180 174"
      direction="ltr"
      aria-hidden="true"
      focusable="false"
      className="h-auto w-32 max-w-full overflow-visible transition-transform duration-300 group-hover:-translate-y-1.5 group-focus-visible:-translate-y-1.5 sm:w-40"
    >
      {/* Slightly uneven, offset strokes reproduce the reference's drawn outline. */}
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M64 18 C88 16 119 17 145 18 C159 18 166 26 166 40 L165 140 C165 154 157 162 143 162 L43 161 C30 161 23 154 23 141 L24 60"
          strokeWidth="4"
          opacity="0.85"
        />
        <path
          d="M55 20 L141 15 C158 14 170 24 169 41 L168 139 C169 156 159 166 142 165 L45 164 C29 165 20 156 21 140 L22 92"
          strokeWidth="1.5"
          opacity="0.45"
        />
        <path d="M74 14 L137 16 M170 51 L170 127 M54 168 L122 167" strokeWidth="1" opacity="0.3" />
      </g>
      <rect
        x="32"
        y="30"
        width="124"
        height="124"
        rx="17"
        fill="#f7f7f5"
        className="[filter:drop-shadow(0_4px_3px_rgba(0,0,0,0.22))]"
      />
      <text
        x="3"
        y="143"
        fill="currentColor"
        fontSize={number < 10 ? 82 : number < 100 ? 62 : 46}
        fontWeight="800"
        fontFamily="Arial, sans-serif"
        letterSpacing="-5"
        className="[filter:drop-shadow(2px_3px_1px_rgba(0,0,0,0.3))]"
      >
        {number}
      </text>
    </svg>
  );
}

export default async function AnalysisMonthFolders({ months, locale }: { months: GalleryMonth[]; locale: Locale }) {
  const [t, tPlatforms] = await Promise.all([
    getTranslations({ locale, namespace: "portal.gallery" }),
    getTranslations({ locale, namespace: "platforms" }),
  ]);

  if (months.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/[0.1] px-5 py-14 text-center text-sm text-[#77766f]">
        <Images className="mx-auto mb-3 size-7" aria-hidden="true" />
        {t("empty")}
      </div>
    );
  }

  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-[9px] font-semibold tracking-[0.24em] text-[#d8be78] uppercase">{t("foldersEyebrow")}</p>
          <h2 className="mt-1 font-satoshi text-2xl tracking-[-0.035em] text-[#f0ede5]">{t("foldersTitle")}</h2>
          <p className="mt-1 text-xs text-[#85837b]">{t("foldersHint")}</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.035] px-3 py-1.5 text-[10px] text-[#aaa79e]">
          <FolderOpen className="size-3.5 text-[#d8be78]" aria-hidden="true" />
          {t("folderCount", { count: months.length })}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-5 sm:grid-cols-3 sm:gap-6 xl:grid-cols-4">
        {months.map((month, index) => {
          const accent = FOLDER_ACCENTS[index % FOLDER_ACCENTS.length];
          const platforms = PLATFORM_ORDER.filter((platform) => month.platforms.includes(platform));
          const monthLabel = monthFormatter.format(new Date(`${month.month}-01T00:00:00Z`));

          return (
            <Link
              key={month.month}
              href={`/${locale}/portal/gallery/${month.month}`}
              prefetch={false}
              aria-label={`${t("openFolder")}: ${monthLabel}`}
              className="group portal-reveal flex min-w-0 flex-col items-center rounded-[22px] px-2 py-5 text-center transition-colors duration-300 hover:bg-white/[0.035] focus-visible:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-4 focus-visible:ring-offset-[#080b18] sm:px-4 sm:py-6"
              style={{ color: accent, animationDelay: `${Math.min(index, 8) * 55}ms` }}
            >
              <FolderArtwork number={index + 1} />

              <div className="mt-4 w-full min-w-0">
                <h3 className="font-satoshi text-sm leading-snug tracking-[-0.025em] text-[#f0ede5] sm:text-base">
                  {monthLabel}
                </h3>
                <p className="mt-1.5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[10px] text-[#aaa79e] sm:text-xs">
                  <span>{t("imagesCount", { count: month.imageCount })}</span>
                  <span aria-hidden="true" className="size-0.5 rounded-full bg-[#77766f]" />
                  <span>{month.reportCount} {t("reportsShort")}</span>
                </p>
                <p className="mt-2 text-[9px] leading-relaxed text-[#85837b] sm:text-[10px]">
                  {formatDateRange(month.periodStart, month.periodEnd, locale)}
                </p>
                <p className="mt-1 text-[9px] leading-relaxed text-[#85837b] sm:text-[10px]">
                  {platforms.map((platform) => tPlatforms(platform)).join(" · ")}
                </p>
              </div>

              <div className="mt-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pt-3">
                {index === 0 && (
                  <span className="rounded-full border border-[#39a99c]/25 bg-[#39a99c]/10 px-2 py-0.5 text-[9px] font-medium text-[#72d7b6]">
                    {t("latest")}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#aaa79e] transition-colors group-hover:text-[#f0ede5] group-focus-visible:text-[#f0ede5]">
                  {t("openFolder")}
                  <ArrowUpRight className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
