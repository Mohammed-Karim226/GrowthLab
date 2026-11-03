import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import SystemHealthDashboard from "@/components/admin/SystemHealthDashboard";
import { requireAdmin } from "@/lib/auth";
import { defaultLocale, isLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type SystemPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: SystemPageProps): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getTranslations({ locale, namespace: "admin.system" });

  return { title: `${t("title")} | GrowthLab` };
}

export default async function AdminSystemPage({ params }: SystemPageProps) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  await requireAdmin(locale);

  return <SystemHealthDashboard />;
}
