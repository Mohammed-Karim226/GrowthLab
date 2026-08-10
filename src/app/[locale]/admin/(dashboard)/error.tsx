"use client";

import { useTranslations } from "next-intl";

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

  return (
    <StateMessage
      title={t("errorTitle")}
      body={t("errorBody")}
      digest={error.digest}
      onRetry={reset}
    />
  );
}
