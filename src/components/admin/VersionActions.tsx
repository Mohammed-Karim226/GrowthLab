"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { BadgeCheck, GitBranch, Globe, Loader2, Trash2, Undo2 } from "lucide-react";
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
  revision,
  versionNumber,
  status,
  currentPublishedVersionId,
  publishedRevision,
  publishedAt,
  metricCount,
  pendingReview,
}: {
  locale: Locale;
  reportId: string;
  reportVersionId: string;
  revision: number;
  versionNumber: number;
  status: ReportStatus;
  currentPublishedVersionId: string | null;
  publishedRevision: number | null;
  publishedAt: string | null;
  metricCount: number;
  pendingReview: number;
}) {
  const t = useTranslations("admin.review.actions");
  const tErrors = useTranslations("admin.errors");
  const router = useRouter();

  const [carryOver, setCarryOver] = useState(true);
  const [isRefreshing, startRefresh] = useTransition();

  function refresh() {
    startRefresh(() => router.refresh());
  }

  function reportError(error: unknown) {
    const key = error instanceof ApiRequestError ? error.errorKey : "serverError";
    toast.error(tErrors(key as never));
    if (error instanceof ApiRequestError && error.status === 409) refresh();
  }

  const approve = useMutation({
    mutationFn: () => apiPost(`/api/admin/reports/${reportId}/approve`, {
      reportVersionId,
      revision,
      expectedPublishedVersionId: currentPublishedVersionId,
    }),
    onSuccess: () => {
      toast.success(t("approved"));
      refresh();
    },
    onError: reportError,
  });

  const publish = useMutation({
    mutationFn: () => apiPost(`/api/admin/reports/${reportId}/publish`, {
      reportVersionId,
      revision,
      expectedPublishedVersionId: currentPublishedVersionId,
    }),
    onSuccess: () => {
      toast.success(t("published"));
      refresh();
    },
    onError: reportError,
  });

  const unpublish = useMutation({
    // A newer draft can be selected while an older version is still live.
    mutationFn: () => {
      if (!currentPublishedVersionId) throw new ApiRequestError(409, "notPublished");
      return apiDelete(`/api/admin/reports/${reportId}/publish`, {
        reportVersionId: currentPublishedVersionId,
        revision: publishedRevision ?? undefined,
        expectedPublishedVersionId: currentPublishedVersionId,
      });
    },
    onSuccess: () => {
      toast.success(t("unpublished"));
      refresh();
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
      refresh();
    },
    onError: reportError,
  });
  const deleteReport = useMutation({
    mutationFn: () => apiDelete<{ deleted: string; cleanupPending: boolean }>(`/api/admin/reports/${reportId}`),
    onSuccess: (data) => {
      if (data.cleanupPending) toast.info(t("deletedCleanupPending"));
      else toast.success(t("deleted"));
      router.replace(`/${locale}/admin`);
    },
    onError: reportError,
  });

  const busy =
    isRefreshing || approve.isPending || publish.isPending || unpublish.isPending || newVersion.isPending || deleteReport.isPending;

  const isPublished = status === "published";
  const hasPublishedVersion = currentPublishedVersionId !== null;
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
        {hasPublishedVersion && publishedAt && (
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

          {hasPublishedVersion && (
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

        {!hasPublishedVersion && !isPublished && !isArchived && (
          <div className="border-t border-red-500/10 pt-4">
            <Button type="button" variant="outline" className="border-red-500/25 text-red-300 hover:bg-red-500/10" disabled={busy} onClick={() => { if (window.confirm(t("deleteConfirm"))) deleteReport.mutate(); }}>
              {deleteReport.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {deleteReport.isPending ? t("deleting") : t("deleteReport")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
