"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { ImageIcon, Loader2, Lock, Sparkles, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statusBadgeVariant } from "@/components/admin/status";
import { ApiRequestError, apiDelete, apiFetch, apiPost } from "@/lib/api-client";
import { validateImageFile } from "@/lib/validation/schemas";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import type { BatchStatus, Platform } from "@/types/database";

export type UploadPanel = {
  key: string;
  platform: Platform;
  accountId: string | null;
  accountName: string | null;
  accountStage: string | null;
  batchId: string | null;
  status: BatchStatus | null;
  notes: string | null;
  images: Array<{ id: string; filename: string | null; fileSize: number | null }>;
};

/** Batch states where screenshots may still be added or removed. */
const EDITABLE: readonly BatchStatus[] = ["draft", "uploading", "uploaded"];

type AnalyzeResponse = { jobId: string; status: string };
type JobStatus = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed" | "dead_letter";
  result: { total?: number; needsReview?: number; unreadable?: string[] } | null;
  error_key: string | null;
};

const ACTIVE_JOB_STATUSES = new Set(["queued", "processing"]);

export default function UploadWorkspace({
  locale,
  reportVersionId,
  locked,
  panels,
}: {
  locale: Locale;
  reportVersionId: string;
  locked: boolean;
  panels: UploadPanel[];
}) {
  const t = useTranslations("admin.workspace");
  const tErrors = useTranslations("admin.errors");
  const router = useRouter();
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);
  // Completed batches are deliberately excluded: their stored AI result is the
  // cache. Only newly uploaded or failed work is sent to the provider again.
  const pendingPanels = panels.filter(
    (panel) =>
      panel.batchId &&
      panel.images.length > 0 &&
      (panel.status === "uploaded" || panel.status === "failed")
  );

  const analyzeAllMutation = useMutation({
    mutationFn: async () => {
      return Promise.all(
        pendingPanels.map((panel) =>
          apiPost<AnalyzeResponse>("/api/admin/insights/analyze", {
            insightBatchId: panel.batchId,
            force: panel.status === "failed",
          })
        )
      );
    },
    onSuccess: (jobs) => {
      toast.success(t("analyzeAllQueued", { count: jobs.length }));
      setActiveJobIds(jobs.map((job) => job.jobId));
    },
    onError: (error) => {
      const key = error instanceof ApiRequestError ? error.errorKey : "serverError";
      toast.error(tErrors(key as never));
    },
  });

  useEffect(() => {
    if (activeJobIds.length === 0) return;

    let disposed = false;
    let refreshing = false;

    const checkJobs = async () => {
      if (disposed || refreshing) return;

      try {
        const response = await apiPost<{ jobs: JobStatus[] }>(
          "/api/admin/insights/jobs",
          { jobIds: activeJobIds }
        );
        if (disposed) return;

        const jobsById = new Map(response.jobs.map((job) => [job.id, job]));
        const finished = activeJobIds
          .map((id) => jobsById.get(id))
          .filter((job): job is JobStatus => Boolean(job));
        const hasActiveJobs = finished.some((job) => ACTIVE_JOB_STATUSES.has(job.status));

        if (!hasActiveJobs && finished.length === activeJobIds.length) {
          refreshing = true;
          setActiveJobIds([]);
          const failed = finished.filter((job) => job.status === "failed" || job.status === "dead_letter");
          if (failed.length > 0) {
            const errorKey = failed[0].error_key ?? "aiFailed";
            toast.error(tErrors(errorKey as never));
          }
          router.refresh();
        }
      } catch (error) {
        if (!disposed) {
          const key = error instanceof ApiRequestError ? error.errorKey : "serverError";
          toast.error(tErrors(key as never));
        }
      }
    };

    void checkJobs();
    const interval = window.setInterval(() => void checkJobs(), 5000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [activeJobIds, router, tErrors]);

  return (
    <section className="space-y-4">
      <div className="space-y-1.5">
        <h2 className="font-satoshi text-lg text-white">{t("uploads")}</h2>
        <p className="text-sm text-slate-400">{t("uploadsHint")}</p>
      </div>

      {locked && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200">
          <Lock className="size-4 shrink-0" aria-hidden />
          {t("versionLocked")}
        </p>
      )}

      {!locked && (
        <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.04] p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
          <div>
            <p className="text-sm font-medium text-white">{t("analyzeAllTitle")}</p>
            <p className="mt-1 text-xs text-slate-400">
              {pendingPanels.length > 0
                ? t("analyzeAllHint", { count: pendingPanels.length })
                : t("analysisCached")}
            </p>
          </div>
          <Button
            type="button"
            disabled={pendingPanels.length === 0 || analyzeAllMutation.isPending}
            onClick={() => analyzeAllMutation.mutate()}
            className="button-primary button-shine mt-3 w-full text-white sm:mt-0 sm:w-auto"
          >
            {analyzeAllMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {analyzeAllMutation.isPending ? t("analyzingAll") : t("analyzeAll")}
          </Button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {panels.map((panel) => (
          <PlatformUploader
            key={panel.key}
            panel={panel}
            locale={locale}
            reportVersionId={reportVersionId}
            versionLocked={locked}
          />
        ))}
      </div>
    </section>
  );
}

function PlatformUploader({
  panel,
  locale,
  reportVersionId,
  versionLocked,
}: {
  panel: UploadPanel;
  locale: Locale;
  reportVersionId: string;
  versionLocked: boolean;
}) {
  const t = useTranslations("admin.workspace");
  const tPlatforms = useTranslations("platforms");
  const tStatus = useTranslations("status");
  const tErrors = useTranslations("admin.errors");
  const router = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Uploads close once the batch leaves the assembly stage; analysis stays
  // available so a failed or reviewed batch can be re-run.
  const locked = versionLocked || (panel.status !== null && !EDITABLE.includes(panel.status));

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      form.set("reportVersionId", reportVersionId);
      form.set("platform", panel.platform);
      if (panel.accountId) form.set("accountId", panel.accountId);
      for (const file of files) form.append("files", file);

      return apiPost<{ rejected: Array<{ filename: string; reason: string }> }>(
        "/api/admin/insights/upload",
        form
      );
    },
    onSuccess: (data) => {
      if (data.rejected.length > 0) {
        toast.warning(t("rejected", { count: data.rejected.length }));
      }
      router.refresh();
    },
    onError: (error) => {
      const key = error instanceof ApiRequestError ? error.errorKey : "serverError";
      toast.error(tErrors(key as never));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId: string) => apiDelete(`/api/admin/insights/images/${imageId}`),
    onSuccess: () => router.refresh(),
    onError: (error) => {
      const key = error instanceof ApiRequestError ? error.errorKey : "serverError";
      toast.error(tErrors(key as never));
    },
  });

  /** Filter locally before the request, so obvious rejects never leave the browser. */
  const submitFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || locked) return;

      const accepted: File[] = [];
      let rejected = 0;

      for (const file of Array.from(fileList)) {
        if (validateImageFile(file).ok) accepted.push(file);
        else rejected += 1;
      }

      if (rejected > 0) toast.warning(t("rejected", { count: rejected }));
      if (accepted.length > 0) uploadMutation.mutate(accepted);
    },
    [locked, t, uploadMutation]
  );

  async function openPreview(imageId: string) {
    try {
      const data = await apiFetch<{ urls: Array<{ imageId: string; url: string | null }> }>(
        "/api/admin/insights/preview",
        { method: "POST", body: JSON.stringify({ imageIds: [imageId] }) }
      );
      const url = data.urls.find((entry) => entry.imageId === imageId)?.url;
      if (url) setPreviewUrl(url);
    } catch (error) {
      const key = error instanceof ApiRequestError ? error.errorKey : "serverError";
      toast.error(tErrors(key as never));
    }
  }

  const busy = uploadMutation.isPending;

  return (
    <Card className="liquid-card border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-sm text-white">{panel.accountName ?? tPlatforms(panel.platform)}</CardTitle>
          {panel.accountName && <p className="mt-1 text-[11px] text-slate-500">{tPlatforms(panel.platform)}{panel.accountStage ? ` · ${panel.accountStage}` : ""}</p>}
        </div>
        <div className="flex items-center gap-2">
          {panel.images.length > 0 && (
            <span className="text-xs text-slate-500">
              {t("uploaded", { count: panel.images.length })}
            </span>
          )}
          {panel.status && (
            <Badge variant={statusBadgeVariant(panel.status)}>{tStatus(panel.status)}</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!locked && (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              submitFiles(event.dataTransfer.files);
            }}
            className={cn(
              "rounded-2xl border border-dashed p-6 text-center transition-colors",
              dragging
                ? "border-cyan-400/50 bg-cyan-400/[0.06]"
                : "border-white/10 bg-white/[0.01]"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                submitFiles(event.target.files);
                event.target.value = "";
              }}
            />

            <div className="flex flex-col items-center gap-2.5">
              <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400">
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Upload className="size-4" aria-hidden />
                )}
              </span>
              <p className="text-sm text-slate-300">
                {busy ? t("uploading") : t("dropHere")}
              </p>
              <p className="text-xs text-slate-500">
                {t("dropHint", { size: formatFileSize(MAX_UPLOAD_BYTES, locale) })}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="mt-1 border-white/10"
              >
                {t("addFiles")}
              </Button>
            </div>
          </div>
        )}

        {panel.images.length === 0 ? (
          <p className="py-2 text-center text-xs text-slate-500">{t("platformEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {panel.images.map((image) => (
              <li
                key={image.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-slate-500">
                  <ImageIcon className="size-3.5" aria-hidden />
                </span>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => openPreview(image.id)}
                  className="h-auto min-w-0 flex-1 justify-start p-0 text-start whitespace-normal hover:bg-transparent"
                >
                  <span className="block truncate text-xs text-slate-300 hover:text-white">
                    {image.filename ?? t("preview")}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {formatFileSize(image.fileSize, locale)}
                  </span>
                </Button>

                {!locked && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("removeImage")}
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm(t("removeConfirm"))) deleteMutation.mutate(image.id);
                    }}
                    className="shrink-0 text-slate-500 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

      </CardContent>

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <button
            type="button"
            aria-label={t("previewClose")}
            onClick={() => setPreviewUrl(null)}
            className="absolute inset-0"
          />
          <div className="relative max-h-[90vh] max-w-3xl overflow-auto rounded-2xl border border-white/10 bg-[#0a0f26] p-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("previewClose")}
              onClick={() => setPreviewUrl(null)}
              className="absolute end-3 top-3 z-10 bg-black/60 text-slate-200"
            >
              <X className="size-4" aria-hidden />
            </Button>
            {/* Signed, short-lived Supabase URL: unoptimized keeps it out of the
                Next image cache and off the CDN. */}
            <Image
              src={previewUrl}
              alt=""
              width={1200}
              height={1600}
              unoptimized
              className="h-auto w-full rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </Card>
  );
}
