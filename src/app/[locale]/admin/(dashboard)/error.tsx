"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { reportError } from "@/lib/observability/report-error";

import StateMessage from "@/components/portal/StateMessage";

/** Admin error boundary. Same rule as the portal: no internals on screen. */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");
  useEffect(() => { reportError(error, { operation: "admin.error-boundary" }); }, [error]);

  return (
    <StateMessage
      title={t("errorTitle")}
      body={t("errorBody")}
      digest={error.digest}
      onRetry={reset}
    />
  );
}
