export const locales = ["en", "ar"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/**
 * Type-guard that checks whether a value is one of the supported locale codes.
 *
 * @param locale - The value to test; may be `undefined`
 * @returns `true` if `locale` is one of the supported locale codes, `false` otherwise.
 */
export function isLocale(locale: string | undefined): locale is Locale {
  return locale !== undefined && locales.includes(locale as Locale);
}

/**
 * Loads and returns the translation dictionary for the given locale.
 *
 * @param locale - Locale code to load the dictionary for
 * @returns The locale's dictionary object (the JSON module's default export)
 */
export async function getDictionary(locale: Locale) {
  return (await import(`../locales/${locale}.json`)).default;
}
