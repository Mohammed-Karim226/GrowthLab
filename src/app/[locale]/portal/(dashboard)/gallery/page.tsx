import { getTranslations } from "next-intl/server";
import { requireClient } from "@/lib/auth";
import { loadPublishedAnalysisMonths } from "@/lib/portal/data";
import AnalysisMonthFolders from "@/components/portal/AnalysisMonthFolders";
import PortalHero from "@/components/portal/PortalHero";
import { defaultLocale, isLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function GalleryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const session = await requireClient(locale);
  const t = await getTranslations({ locale, namespace: "portal.gallery" });
  const months = await loadPublishedAnalysisMonths(session.clientId);
  return <div className="space-y-6"><PortalHero compact eyebrow={t("eyebrow")} title={t("title")} period={t("subtitle")} publishedLabel={t("privateOnly")} comparisonLabel={t("sourceNote")} /><AnalysisMonthFolders months={months} locale={locale} /></div>;
}
