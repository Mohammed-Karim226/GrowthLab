"use client";

import { useLocale, useTranslations } from "next-intl";

import StateMessage from "@/components/portal/StateMessage";

/**
 * Reached when a report id does not resolve to a *published* report belonging
 * to the signed-in client — including when it belongs to someone else. The
 * wording is identical either way, so a 404 never confirms that an id exists
 * (plan §43).
 */
export default function PortalReportNotFound() {
  const t = useTranslations("common");
  const tReports = useTranslations("portal.reports");
  const locale = useLocale();

  return (
    <StateMessage
      title={t("notFoundTitle")}
      body={t("notFoundBody")}
      backHref={`/${locale}/portal/reports`}
      backLabel={tReports("backToReports")}
    />
  );
}
