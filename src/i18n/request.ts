import { getRequestConfig } from "next-intl/server";
import { defaultLocale, getDictionary, isLocale } from "@/lib/i18n";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : defaultLocale;

  return {
    locale,
    messages: await getDictionary(locale),
  };
});
