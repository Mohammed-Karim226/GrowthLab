export const locales = ["en", "ar"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export function isLocale(locale: string | undefined): locale is Locale {
  return locale !== undefined && locales.includes(locale as Locale);
}

/** Text direction for a locale. Used by layouts and RTL-aware components. */
export function directionOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/**
 * Merge the marketing dictionary with the admin/portal dictionary.
 *
 * Kept as two files so the large existing marketing copy stays untouched while
 * the portal namespaces (auth, common, platforms, metrics, admin, portal…)
 * evolve separately. Top-level namespaces do not overlap; the portal bundle
 * wins on collision.
 */
export async function getDictionary(locale: Locale) {
  const [marketing, portal] = await Promise.all([
    import(`../locales/${locale}.json`),
    import(`../locales/portal/${locale}.json`),
  ]);

  return { ...marketing.default, ...portal.default };
}
