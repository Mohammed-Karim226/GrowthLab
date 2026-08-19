"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiRequestError, apiPost } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { AiSummaryPayload } from "@/types/database";

/**
 * The written interpretation.
 *
 * Draft copy for the admin, not client-facing output: this panel renders the
 * validated payload, never a raw model response (plan §17). Publishing it is a
 * separate, explicit step.
 */
export default function SummaryPanel({
  locale,
  reportId,
  reportVersionId,
  summary,
  locked,
  hasReviewedMetrics,
}: {
  locale: Locale;
  reportId: string;
  reportVersionId: string;
  summary: AiSummaryPayload | null;
  locked: boolean;
  hasReviewedMetrics: boolean;
}) {
  const t = useTranslations("admin.workspace");
  const tErrors = useTranslations("admin.errors");
  const router = useRouter();

  const [current, setCurrent] = useState<AiSummaryPayload | null>(summary);

  const mutation = useMutation({
    mutationFn: (force: boolean) =>
      apiPost<{ aiSummary: AiSummaryPayload }>(
        // Locale rides in the query string: the summary is written in the
        // language the admin is working in.
        `/api/admin/reports/${reportId}/summary?locale=${locale}`,
        { reportVersionId, force }
      ),
    onSuccess: (data) => {
      setCurrent(data.aiSummary);
      router.refresh();
    },
    onError: (error) => {
      const key = error instanceof ApiRequestError ? error.errorKey : "serverError";
      toast.error(tErrors(key as never));
    },
  });

  const busy = mutation.isPending;

  return (
    <Card className="liquid-card border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-sm text-white">{t("summary")}</CardTitle>
          <p className="text-xs text-slate-500">{t("summaryHint")}</p>
        </div>

        {!locked && (
          <Button
            type="button"
            variant={current ? "outline" : "default"}
            size="sm"
            disabled={busy || !hasReviewedMetrics}
            onClick={() => {
              if (current && !window.confirm(t("summaryConfirm"))) return;
              mutation.mutate(Boolean(current));
            }}
            className={current ? "border-white/10" : "button-primary button-shine text-white"}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3.5" aria-hidden />
            )}
            {busy
              ? t("generatingSummary")
              : current
                ? t("regenerateSummary")
                : t("generateSummary")}
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {!current ? (
          <p className="py-2 text-sm text-slate-500">{t("summaryEmpty")}</p>
        ) : (
          <div className="space-y-5">
            <p className="text-sm leading-relaxed text-slate-200">{current.summary}</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <SummaryList title={t("wentWell")} items={current.went_well} />
              <SummaryList title={t("whatChanged")} items={current.what_changed} />
              <SummaryList title={t("needsAttention")} items={current.needs_attention} />
              <SummaryList title={t("recommendations")} items={current.recommendations} />
            </div>

            <p className="text-[11px] text-slate-500">
              {t("summaryGenerated", { date: formatDate(current.generated_at, locale) })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** An empty section is dropped rather than shown as a heading with nothing under it. */
function SummaryList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-medium text-slate-400">{title}</h3>
      <ul className="list-disc space-y-1 ps-4 text-xs leading-relaxed text-slate-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
