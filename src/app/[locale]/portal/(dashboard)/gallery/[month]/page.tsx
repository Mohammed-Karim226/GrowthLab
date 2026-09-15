import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, CalendarDays, FolderOpen } from "lucide-react";

import AnalysisGallery from "@/components/portal/AnalysisGallery";
import PortalHero from "@/components/portal/PortalHero";
import { requireClient } from "@/lib/auth";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { loadPublishedAnalysisGallery } from "@/lib/portal/data";

export const dynamic = "force-dynamic";

export default async function GalleryMonthPage({ params }: { params: Promise<{ locale: string; month: string }> }) {
  const { locale: raw, month } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) notFound();

  const session = await requireClient(locale);
  const [t, images] = await Promise.all([
    getTranslations({ locale, namespace: "portal.gallery" }),
    loadPublishedAnalysisGallery(session.clientId, month),
  ]);
  const formattedMonth = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  const platformCount = new Set(images.map((image) => image.platform)).size;

  return <div className="space-y-6">
    <Link href={`/${locale}/portal/gallery`} className="portal-glass-chip inline-flex items-center gap-2 rounded-full border border-white/[0.13] px-3.5 py-2 text-[10px] font-medium text-[#b8bdcc] transition-all hover:-translate-y-0.5 hover:border-white/25 hover:text-white"><ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />{t("backToFolders")}</Link>
    <PortalHero compact eyebrow={t("folderEyebrow")} title={formattedMonth} period={t("monthSubtitle")} publishedLabel={t("imagesCount", { count: images.length })} comparisonLabel={t("platformsCount", { count: platformCount })} />
    <div className="flex items-center gap-2 text-[10px] text-[#85837b]"><FolderOpen className="size-3.5 text-[#d8be78]" /><span>{t("folderContents")}</span><CalendarDays className="ms-2 size-3.5 text-[#77766f]" /><span>{month}</span></div>
    <AnalysisGallery images={images} locale={locale} />
  </div>;
}
