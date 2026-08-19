"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { BadgeCheck, GitBranch, Globe, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiRequestError, apiDelete, apiPost } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { ReportStatus, ReportVersionRow } from "@/types/database";

/**
 * The approve → publish → withdraw controls.
 *
 * Each button maps to one server route that re-checks the same conditions; the
 * disabled states here are a courtesy, not the enforcement (plan §33, §43).
 */
export default function VersionActions({
  locale,
  reportId,
  reportVersionId,
  versionNumber,
  status,
  publishedAt,
  metricCount,
  pendingReview,
}: {
  locale: Locale;
  reportId: string;
  reportVersionId: string;
  versionNumber: number;
  status: ReportStatus;
  publishedAt: string | null;
  metricCount: number;
  pendingReview: number;
}) {
  const t = useTranslations("admin.review.actions");
  const tErrors = useTranslations("admin.errors");
  const router = useRouter();

  const [carryOver, setCarryOver] = useState(true);

  function reportError(error: unknown) {
    const key = error instanceof ApiRequestError ? error.errorKey : "serverError";
    toast.error(tErrors(key as never));
  }

  const approve = useMutation({
    mutationFn: () => apiPost(`/api/admin/reports/${reportId}/approve`, { reportVersionId }),
    onSuccess: () => {
      toast.success(t("approved"));
      router.refresh();
    },
    onError: reportError,
  });

  const publish = useMutation({
    mutationFn: () => apiPost(`/api/admin/reports/${reportId}/publish`, { reportVersionId }),
    onSuccess: () => {
      toast.success(t("published"));
      router.refresh();
    },
    onError: reportError,
  });

  const unpublish = useMutation({
    // The version id rides along so the server refuses if this view is stale.
    mutationFn: () => apiDelete(`/api/admin/reports/${reportId}/publish`, { reportVersionId }),
    onSuccess: () => {
      toast.success(t("unpublished"));
      router.refresh();
    },
    onError: reportError,
  });

  const newVersion = useMutation({
    mutationFn: () =>
      apiPost<{ version: ReportVersionRow }>(`/api/admin/reports/${reportId}/versions`, {
        reportId,
        carryOverMetrics: carryOver,
      }),
    onSuccess: (data) => {
      toast.success(t("versionCreated", { number: data.version.version_number }));
      router.refresh();
    },
    onError: reportError,
  });

  const busy =
    approve.isPending || publish.isPending || unpublish.isPending || newVersion.isPending;

  const isPublished = status === "published";
  const isArchived = status === "archived";
  const canApprove = !isPublished && !isArchived && metricCount > 0 && pendingReview === 0;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <BadgeCheck className="size-4 text-emerald-400" aria-hidden />
          {t("title")}
        </CardTitle>
        <p className="text-sm text-slate-400">{t("hint")}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {isPublished && publishedAt && (
          <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-sm text-emerald-200">
            {t("liveNow", { date: formatDate(publishedAt, locale) })}
          </p>
        )}

        {!canApprove && !isPublished && !isArchived && pendingReview > 0 && (
          <p className="text-sm text-amber-200">{t("reviewFirst")}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!isPublished && !isArchived && status !== "approved" && (
            <Button
              onClick={() => {
                if (window.confirm(t("approveConfirm"))) approve.mutate();
              }}
              disabled={busy || !canApprove}
            >
              {approve.isPending ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
              {approve.isPending ? t("approving") : t("approve")}
            </Button>
          )}

          {status === "approved" && (
            <Button
              onClick={() => {
                if (window.confirm(t("publishConfirm"))) publish.mutate();
              }}
              disabled={busy}
            >
              {publish.isPending ? <Loader2 className="animate-spin" /> : <Globe />}
              {publish.isPending ? t("publishing") : t("publish")}
            </Button>
          )}

          {isPublished && (
            <Button
              variant="outline"
              onClick={() => {
                if (window.confirm(t("unpublishConfirm"))) unpublish.mutate();
              }}
              disabled={busy}
            >
              {unpublish.isPending ? <Loader2 className="animate-spin" /> : <Undo2 />}
              {unpublish.isPending ? t("unpublishing") : t("unpublish")}
            </Button>
          )}

          {(isPublished || isArchived) && (
            <Button
              variant="secondary"
              onClick={() => {
                if (window.confirm(t("newVersionConfirm", { number: versionNumber + 1 })))
                  newVersion.mutate();
              }}
              disabled={busy}
            >
              {newVersion.isPending ? <Loader2 className="animate-spin" /> : <GitBranch />}
              {newVersion.isPending ? t("creatingVersion") : t("newVersion")}
            </Button>
          )}
        </div>

        {(isPublished || isArchived) && (
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <Checkbox
              checked={carryOver}
              onChange={(event) => setCarryOver(event.target.checked)}
              disabled={busy}
              className="size-4 rounded border-border bg-transparent accent-primary"
            />
            {t("carryOverLabel")}
          </label>
        )}
      </CardContent>
    </Card>
  );
}
