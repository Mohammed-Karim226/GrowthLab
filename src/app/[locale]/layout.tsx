import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getDictionary, isLocale, locales } from "@/lib/i18n";

export const dynamicParams = false;

/**
 * Produces static route parameter objects for every supported locale.
 *
 * @returns An array of objects like `{ locale: string }`, one per entry in `locales`
 */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/**
 * Provides a locale-aware layout that supplies translation messages and sets text direction.
 *
 * Loads translation messages for `params.locale`, validates the locale, and renders `children`
 * inside a `NextIntlClientProvider`. The wrapper `<div>` sets `dir` to `"rtl"` when the locale
 * is `"ar"`, otherwise `"ltr"`.
 *
 * @param children - The React nodes to render inside the layout.
 * @param params - Route parameters object; expects a `locale` property with a supported locale.
 * @returns A React element that wraps `children` with internationalization context and a directioned container.
 *
 * Triggers a 404 response when `params.locale` is not a supported locale.
 */
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
