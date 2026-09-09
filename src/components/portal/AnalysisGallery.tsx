"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, Layers3, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateRange } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { GalleryImage } from "@/lib/portal/data";
import type { Platform } from "@/types/database";

const PLATFORMS: Platform[] = ["facebook", "instagram", "tiktok", "youtube"];

export default function AnalysisGallery({ images, locale }: { images: GalleryImage[]; locale: Locale }) {
  const t = useTranslations("portal.gallery");
  const tPlatforms = useTranslations("platforms");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const platformItems = [{ value: "all", label: t("allPlatforms") }, ...PLATFORMS.map((value) => ({ value, label: tPlatforms(value) }))];
  const filtered = useMemo(() => images.filter((image) => platform === "all" || image.platform === platform), [images, platform]);
  const grouped = useMemo(() => {
    const map = new Map<string, { title: string; periodStart: string; periodEnd: string; images: GalleryImage[] }>();
    for (const image of filtered) {
      const current = map.get(image.reportId) ?? { title: image.reportTitle, periodStart: image.periodStart, periodEnd: image.periodEnd, images: [] };
      current.images.push(image);
      map.set(image.reportId, current);
    }
    return [...map.entries()]
      .map(([id, report]) => ({ id, ...report }))
      .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  }, [filtered]);
  const selectedIndex = selectedId ? filtered.findIndex((image) => image.id === selectedId) : -1;
  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null;

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
      if (event.key === "ArrowLeft" && selectedIndex > 0) setSelectedId(filtered[selectedIndex - 1].id);
      if (event.key === "ArrowRight" && selectedIndex < filtered.length - 1) setSelectedId(filtered[selectedIndex + 1].id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtered, selected, selectedIndex]);

  return <section className="space-y-5">
    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 sm:flex-row sm:items-center">
      <div><p className="text-[9px] font-semibold tracking-[0.18em] text-[#77766f] uppercase">{t("monthViewEyebrow")}</p><p className="mt-1 text-xs text-[#aaa79e]">{t("monthViewHint")}</p></div>
      <Select value={platform} onValueChange={(value) => { if (value) { setPlatform(value as Platform | "all"); setSelectedId(null); } }} items={platformItems}>
        <SelectTrigger aria-label={t("allPlatforms")} className="w-full bg-white/[0.035] sm:w-56"><span className="flex min-w-0 items-center gap-2"><Layers3 className="size-4 shrink-0 text-cyan-200" /><SelectValue /></span></SelectTrigger>
        <SelectContent>{platformItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>

    {filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-white/[0.1] px-5 py-14 text-center text-sm text-[#77766f]"><ImageIcon className="mx-auto mb-3 size-7" />{t("emptyMonth")}</div> : <div className="space-y-8">{grouped.map((report, reportIndex) => <section key={report.id} className="space-y-3 portal-reveal" style={{ animationDelay: `${reportIndex * 55}ms` }}><div className="flex flex-col gap-1.5 border-b border-white/[0.07] pb-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-satoshi text-xl tracking-[-0.025em] text-[#f0ede5]">{report.title}</h2><p className="mt-1 text-[10px] text-[#77766f]">{formatDateRange(report.periodStart, report.periodEnd, locale)}</p></div><span className="text-[10px] text-[#aaa79e]">{t("imagesCount", { count: report.images.length })}</span></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{report.images.map((image) => <button key={image.id} type="button" onClick={() => setSelectedId(image.id)} className="group overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.03] text-start transition-all duration-300 hover:-translate-y-1 hover:border-[#d8be78]/25"><img src={image.url} alt={image.filename ?? t("imageAlt")} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" /><div className="p-3"><p className="truncate text-xs text-[#e5e0d4]">{image.filename ?? t("imageAlt")}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-[#85837b]">{tPlatforms(image.platform)} · {t("sourceImage")}</p></div></button>)}</div></section>)}</div>}

    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={selected.filename ?? t("imageAlt")} onClick={() => setSelectedId(null)}><div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-white/[0.13] bg-[#080b16] shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-4 py-3 sm:px-5"><div className="min-w-0"><p className="truncate text-xs text-[#e5e0d4]">{selected.filename ?? t("imageAlt")}</p><p className="mt-1 text-[10px] text-[#85837b]">{selected.reportTitle} · {tPlatforms(selected.platform)}</p></div><button type="button" aria-label={t("close")} title={t("close")} onClick={() => setSelectedId(null)} className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.05] text-white transition-colors hover:bg-white/[0.12]"><X className="size-4" /></button></div><div className="relative flex min-h-[45vh] flex-1 items-center justify-center bg-black/30 p-4 sm:min-h-[58vh] sm:p-8"><img src={selected.url} alt={selected.filename ?? t("imageAlt")} className="max-h-[68vh] max-w-full rounded-lg object-contain" />{selectedIndex > 0 && <button type="button" aria-label={t("previousImage")} title={t("previousImage")} onClick={() => setSelectedId(filtered[selectedIndex - 1].id)} className="absolute start-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.12] bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/85 sm:start-5"><ChevronLeft className="size-5 rtl:rotate-180" /></button>}{selectedIndex < filtered.length - 1 && <button type="button" aria-label={t("nextImage")} title={t("nextImage")} onClick={() => setSelectedId(filtered[selectedIndex + 1].id)} className="absolute end-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.12] bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/85 sm:end-5"><ChevronRight className="size-5 rtl:rotate-180" /></button>}</div><div className="flex items-center justify-between gap-4 border-t border-white/[0.08] px-4 py-3 text-[10px] text-[#85837b] sm:px-5"><span>{t("imagePosition", { current: selectedIndex + 1, total: filtered.length })}</span><span>{formatDateRange(selected.periodStart, selected.periodEnd, locale)}</span></div></div></div>}
  </section>;
}
