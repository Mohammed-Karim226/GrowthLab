import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

import LoginForm, { LoginShell } from "@/components/auth/LoginForm";
import { getSessionContext, homePathForRole } from "@/lib/auth";
import { defaultLocale, isLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: isLocale(locale) ? locale : defaultLocale,
    namespace: "auth",
  });
  return { title: t("adminTitle"), robots: { index: false, follow: false } };
}

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : defaultLocale;

  // Only an authorized admin session can skip this area's login screen.
  const session = await getSessionContext();
  if (session?.profile.role === "admin") {
    redirect(homePathForRole(session.profile.role, safeLocale));
  }

  const t = await getTranslations({ locale: safeLocale, namespace: "auth" });

  return (
    <LoginShell
      title={t("adminTitle")}
      subtitle={t("adminSubtitle")}
      footnote={t("secureNotice")}
    >
      <LoginForm expectedRole="admin" />
    </LoginShell>
  );
}
