import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight, CalendarDays, FolderOpen, Images, ScanLine } from "lucide-react";

import { formatDateRange } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { GalleryMonth } from "@/lib/portal/data";
import type { Platform } from "@/types/database";

const FOLDER_STYLES = [
  { accent: "#e2c87e", border: "border-[#d8be78]/30 hover:border-[#e8d18a]/70", line: "bg-[#d8be78]", wash: "from-[#d8be78]/35" },
  { accent: "#72d7b6", border: "border-[#54d8ac]/25 hover:border-[#72d7b6]/65", line: "bg-[#54d8ac]", wash: "from-[#54d8ac]/30" },
  { accent: "#bde5f0", border: "border-cyan-200/25 hover:border-cyan-100/65", line: "bg-cyan-200", wash: "from-cyan-200/30" },
  { accent: "#f19b77", border: "border-[#ed8f6d]/25 hover:border-[#f19b77]/65", line: "bg-[#ed8f6d]", wash: "from-[#ed8f6d]/30" },
] as const;

const PLATFORM_ORDER: Platform[] = ["facebook", "instagram", "tiktok", "youtube"];

export default async function AnalysisMonthFolders({ months, locale }: { months: GalleryMonth[]; locale: Locale }) {
  const [t, tPlatforms] = await Promise.all([
    getTranslations({ locale, namespace: "portal.gallery" }),
    getTranslations({ locale, namespace: "platforms" }),
  ]);

  if (months.length === 0) {
    return <div className="rounded-2xl border border-dashed border-white/[0.1] px-5 py-14 text-center text-sm text-[#77766f]"><Images className="mx-auto mb-3 size-7" />{t("empty")}</div>;
  }

  const formatMonth = (value: string) => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T00:00:00Z`));

  return <section className="space-y-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <p className="text-[9px] font-semibold tracking-[0.24em] text-[#d8be78] uppercase">{t("foldersEyebrow")}</p>
        <h2 className="mt-1 font-satoshi text-2xl tracking-[-0.035em] text-[#f0ede5]">{t("foldersTitle")}</h2>
        <p className="mt-1 text-xs text-[#85837b]">{t("foldersHint")}</p>
      </div>
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.035] px-3 py-1.5 text-[10px] text-[#aaa79e]"><FolderOpen className="size-3.5 text-[#d8be78]" />{t("folderCount", { count: months.length })}</span>
    </div>

    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {months.map((month, index) => {
        const style = FOLDER_STYLES[index % FOLDER_STYLES.length];
        const platforms = PLATFORM_ORDER.filter((platform) => month.platforms.includes(platform));
        return <Link key={month.month} href={`/${locale}/portal/gallery/${month.month}`} prefetch={false} className="group relative block pt-4 portal-reveal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8be78]/70 focus-visible:ring-offset-4 focus-visible:ring-offset-[#080b18]" style={{ animationDelay: `${index * 55}ms` }}>
          <span className="absolute start-5 top-0 z-30 flex h-9 items-center gap-2 rounded-t-[13px] border border-white/[0.12] bg-[#121a2b]/95 px-3.5 text-[9px] font-bold tracking-[0.17em] uppercase shadow-[0_-8px_28px_rgba(0,0,0,0.24),0_8px_18px_rgba(0,0,0,0.18)] backdrop-blur-xl" style={{ color: style.accent, boxShadow: `0 -8px 28px rgba(0,0,0,0.24), 0 8px 18px ${style.accent}22` }}><span className="flex size-5 items-center justify-center rounded-md border border-current/30 bg-black/25"><FolderOpen className="size-3.5" strokeWidth={1.8} /></span>{t("folderLabel")}</span>
          <article className={`relative isolate overflow-hidden rounded-[25px] rounded-ss-[9px] border bg-[#0a0f1d] shadow-[0_20px_65px_rgba(0,0,0,0.28)] transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_32px_90px_rgba(0,0,0,0.42)] ${style.border}`}>
            <div aria-hidden className="relative h-[178px] overflow-hidden border-b border-white/[0.08] bg-[#12182a]">
              {month.coverUrl ? <img src={month.coverUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover opacity-80 saturate-[0.85] transition duration-700 group-hover:scale-105 group-hover:opacity-95" /> : <div className="absolute inset-0 bg-[linear-gradient(135deg,#172039,#0d1324_55%,#18261f)]" />}
              <div className={`absolute inset-0 bg-gradient-to-t ${style.wash} via-[#080b18]/55 to-[#080b18]/[0.08]`} />
              <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.12),transparent_32%,transparent_68%,rgba(0,0,0,0.24))]" />
              <div className="absolute inset-x-5 top-4 flex items-start justify-between gap-3">
                <span className="rounded-full border border-white/20 bg-black/25 px-2.5 py-1 text-[9px] font-semibold tracking-[0.13em] text-white/80 backdrop-blur-md">{month.month}</span>
                {index === 0 && <span className="rounded-full border border-[#72d7b6]/40 bg-[#0b2a26]/70 px-2.5 py-1 text-[9px] font-semibold tracking-[0.12em] text-[#9ae5c9] uppercase backdrop-blur-md">{t("latest")}</span>}
              </div>
              <div className="absolute inset-x-5 bottom-4 flex items-end justify-between gap-3"><div><p className="text-[9px] font-semibold tracking-[0.18em] text-white/60 uppercase">{t("folderLabel")}</p><h3 className="mt-1 font-satoshi text-[26px] capitalize leading-none tracking-[-0.045em] text-white">{formatMonth(month.month)}</h3></div><span className="flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/25 text-white backdrop-blur-md transition-all group-hover:bg-white group-hover:text-[#111728]"><ArrowUpRight className="size-[18px] rtl:-scale-x-100" /></span></div>
            </div>

            <div className="relative p-5">
              <div className="flex items-center justify-between gap-3 text-[10px] text-[#85837b]"><span className="inline-flex min-w-0 items-center gap-1.5 truncate"><CalendarDays className="size-3.5 shrink-0" />{formatDateRange(month.periodStart, month.periodEnd, locale)}</span><span className="shrink-0 tabular-nums" style={{ color: style.accent }}>{month.imageCount} {t("images")}</span></div>
              <div className="mt-5 flex items-center gap-2"><ScanLine className="size-3.5" style={{ color: style.accent }} /><span className="text-[9px] font-semibold tracking-[0.16em] text-[#77766f] uppercase">{t("preview")}</span><span className="ms-auto text-[9px] text-[#686861]">{month.reportCount} {t("reportsShort")}</span></div>
              <div className="mt-2.5 space-y-2">
                {month.reports.slice(0, 2).map((report, reportIndex) => <div key={report.id} className="flex min-w-0 items-center gap-2"><span className={`size-1.5 shrink-0 rounded-full ${style.line}`} /><span className="truncate text-[10px] text-[#c7c3b8]">{report.title}</span><span className="ms-auto text-[9px] tabular-nums text-[#686861]">{String(reportIndex + 1).padStart(2, "0")}</span></div>)}
                {month.reports.length > 2 && <p className="ps-3.5 text-[9px] text-[#77766f]">+{month.reports.length - 2} {t("moreReports")}</p>}
              </div>
              <div className="mt-5 flex min-h-6 flex-wrap items-center gap-1.5 border-t border-white/[0.08] pt-4">{platforms.map((platform) => <span key={platform} className="rounded-full border border-white/[0.09] bg-white/[0.035] px-2 py-1 text-[9px] text-[#aaa79e]">{tPlatforms(platform)}</span>)}<span className="ms-auto text-[10px] font-medium text-[#9d998f] transition-colors group-hover:text-white">{t("openFolder")}</span></div>
            </div>
          </article>
        </Link>;
      })}
    </div>
  </section>;
}
