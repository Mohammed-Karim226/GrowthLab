"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ImageIcon, Layers3, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GalleryImage } from "@/lib/portal/data";
import type { Platform } from "@/types/database";

const PLATFORMS: Platform[] = ["facebook", "instagram", "tiktok", "youtube"];

export default function AnalysisGallery({ images }: { images: GalleryImage[] }) {
  const t = useTranslations("portal.gallery");
  const tPlatforms = useTranslations("platforms");
  const [month, setMonth] = useState("all");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [selected, setSelected] = useState<GalleryImage | null>(null);
  const formatMonth = (value: string) => new Date(`${value}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const months = useMemo(() => [...new Set(images.map((image) => image.periodEnd.slice(0, 7)))], [images]);
  const monthItems = [{ value: "all", label: t("allMonths") }, ...months.map((value) => ({ value, label: formatMonth(value) }))];
  const platformItems = [{ value: "all", label: t("allPlatforms") }, ...PLATFORMS.map((value) => ({ value, label: tPlatforms(value) }))];
  const filtered = images.filter((image) => (month === "all" || image.periodEnd.startsWith(month)) && (platform === "all" || image.platform === platform));
  const grouped = useMemo(() => {
    const map = new Map<string, GalleryImage[]>();
    for (const image of filtered) {
      const key = image.periodEnd.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), image]);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  return <section className="space-y-5">
    <div className="grid gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 sm:max-w-xl sm:grid-cols-2">
      <Select value={month} onValueChange={(value) => value && setMonth(value)} items={monthItems}>
        <SelectTrigger aria-label={t("allMonths")} className="bg-white/[0.035]"><span className="flex min-w-0 items-center gap-2"><CalendarDays className="size-4 shrink-0 text-[#d8be78]" /><SelectValue /></span></SelectTrigger>
        <SelectContent>{monthItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={platform} onValueChange={(value) => value && setPlatform(value as Platform | "all")} items={platformItems}>
        <SelectTrigger aria-label={t("allPlatforms")} className="bg-white/[0.035]"><span className="flex min-w-0 items-center gap-2"><Layers3 className="size-4 shrink-0 text-cyan-200" /><SelectValue /></span></SelectTrigger>
        <SelectContent>{platformItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>

    {filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-white/[0.1] px-5 py-14 text-center text-sm text-[#77766f]"><ImageIcon className="mx-auto mb-3 size-7" />{t("empty")}</div> : <div className="space-y-8">{grouped.map(([period, periodImages]) => <section key={period} className="space-y-3"><div className="flex items-center gap-3"><h2 className="font-satoshi text-xl text-[#f0ede5]">{formatMonth(period)}</h2><span className="rounded-full border border-[#d8be78]/20 bg-[#d8be78]/[0.08] px-2.5 py-1 text-[10px] text-[#d8be78]">{periodImages.length}</span><span className="h-px flex-1 bg-white/[0.07]" /></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{periodImages.map((image) => <button key={image.id} type="button" onClick={() => setSelected(image)} className="group overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.03] text-start"><img src={image.url} alt={image.filename ?? t("imageAlt")} className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" /><div className="p-3"><p className="truncate text-xs text-[#e5e0d4]">{image.filename ?? image.reportTitle}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-[#85837b]">{tPlatforms(image.platform)} · {image.reportTitle}</p></div></button>)}</div></section>)}</div>}

    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" onClick={() => setSelected(null)}><div className="relative max-h-[90vh] max-w-5xl" onClick={(event) => event.stopPropagation()}><button type="button" aria-label={t("close")} onClick={() => setSelected(null)} className="absolute -end-3 -top-3 rounded-full bg-white p-2 text-black"><X className="size-4" /></button><img src={selected.url} alt={selected.filename ?? t("imageAlt")} className="max-h-[85vh] rounded-xl object-contain" /></div></div>}
  </section>;
}
