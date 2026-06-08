import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getDictionary, isLocale, locales } from "@/lib/i18n";

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: any) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const messages = await getDictionary(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div dir={locale === "ar" ? "rtl" : "ltr"}>{children}</div>
    </NextIntlClientProvider>
  );
}
