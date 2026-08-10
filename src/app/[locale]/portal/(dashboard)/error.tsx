"use client";

import { useTranslations } from "next-intl";

import StateMessage from "@/components/portal/StateMessage";

/**
 * Portal error boundary.
 *
 * Next.js has already stripped the message on the server; this shows a fixed
 * sentence and the digest only, so no provider or database text can reach a
 * client's screen (plan §52).
 */
export default function PortalError({
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
