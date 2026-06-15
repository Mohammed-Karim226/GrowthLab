import { redirect } from "next/navigation";
import { defaultLocale } from "@/lib/i18n";

/**
 * Redirects the incoming request to the application's default locale root.
 *
 * Triggers a navigation redirect to `/${defaultLocale}` when this page is rendered.
 */
export default function Page() {
  redirect(`/${defaultLocale}`);
}
