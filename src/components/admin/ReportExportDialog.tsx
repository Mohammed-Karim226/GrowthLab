"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDownToLine, CheckCheck, FileText, Info, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Locale } from "@/lib/i18n";
import type { ReportStatus } from "@/types/database";
import { ReportPdfDownloadError, requestReportPdf, saveReportPdf } from "@/lib/reports/export/client";
import { reportPdfDefaults, reportPdfSections, type ReportPdfOptions } from "@/lib/reports/export/contract";

export default function ReportExportDialog({
  locale,
  reportId,
  reportVersionId,
  revision,
  versionNumber,
  status,
  reportTitle,
  clientName,
  pendingReview,
  metricCount,
}: {
  locale: Locale;
  reportId: string;
  reportVersionId: string;
  revision: number;
  versionNumber: number;
  status: ReportStatus;
  reportTitle: string;
  clientName: string;
  pendingReview: number;
  metricCount: number;
}) {
  const t = useTranslations("admin.reports.export");
  const tErrors = useTranslations("admin.errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ReportPdfOptions>({ ...reportPdfDefaults, locale });
  const { locale: exportLocale, pageSize } = options;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const reviewedCount = Math.max(0, metricCount - pendingReview);
  const unavailable = status === "processing" ? t("processingNotice") : reviewedCount === 0 ? t("noMetrics") : null;

  useEffect(() => () => {
    activeRequest.current?.abort();
    activeRequest.current = null;
  }, []);

  function changeOpen(next: boolean) {
    if (!next) {
      activeRequest.current?.abort();
      activeRequest.current = null;
      setPending(false);
    }
    setError(null);
    setOpen(next);
  }

  async function downloadReport() {
    if (activeRequest.current || unavailable) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(true);
    setError(null);

    try {
      const { blob, filename } = await requestReportPdf({
        reportId,
        reportVersionId,
        revision,
        ...options,
      }, controller.signal);
      if (controller.signal.aborted) return;
      saveReportPdf(blob, filename);
      toast.success(t("success"));
      setOpen(false);
    } catch (cause) {
      if (controller.signal.aborted) return;
      const key = cause instanceof ReportPdfDownloadError ? cause.errorKey : "error";
      setError(t.has(key) ? t(key) : tErrors.has(key) ? tErrors(key) : t("error"));
      if (cause instanceof ReportPdfDownloadError && cause.status === 409) router.refresh();
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setPending(false);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <span title={unavailable ?? undefined}>
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(unavailable)}
              aria-label={unavailable ? `${t("trigger")}. ${unavailable}` : undefined}
              className="h-10 gap-2 border-[#edd27b]/25 bg-[#edd27b]/[0.07] px-4 text-[#f3d98b] hover:border-[#edd27b]/45 hover:bg-[#edd27b]/[0.13] hover:text-[#fff0b3]"
            />
          }
        >
          <ArrowDownToLine className="size-4" aria-hidden />
          {t("trigger")}
        </DialogTrigger>
      </span>

      <DialogContent className="vip-dialog max-w-3xl gap-5" dir={locale === "ar" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#edd27b]/20 bg-[#edd27b]/10 text-[#edd27b]">
              <FileText className="size-5" aria-hidden />
            </span>
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="grid items-start gap-6 sm:grid-cols-[190px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <div aria-hidden="true" className="mx-auto hidden w-full max-w-[190px] overflow-hidden rounded-md border border-slate-200 bg-white p-3.5 shadow-[0_20px_55px_rgba(0,0,0,.25)] sm:flex sm:flex-col" style={{ aspectRatio: pageSize === "A4" ? "210 / 297" : "8.5 / 11" }} dir={exportLocale === "ar" ? "rtl" : "ltr"}>
              <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 text-[9px] font-semibold text-slate-900" dir="ltr">
                <span className="grid size-4 place-items-center rounded border border-[#b18b40]/35 text-[9px] text-[#b18b40]">G</span>
                GrowthLab
              </div>
              <div className="mt-3 rounded bg-[#0b1020] p-2.5">
                <p className="text-[6px] text-[#e0c98f]">{t("previewLabel")}</p>
                <p className="mt-1 line-clamp-3 text-[11px] font-semibold leading-snug text-white">{reportTitle}</p>
                <p className="mt-2 line-clamp-2 border-t border-white/15 pt-1.5 text-[7px] text-slate-300">{clientName}</p>
              </div>
              <div className="mt-3 h-1.5 w-20 rounded-sm bg-slate-700" />
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {Array.from({ length: 6 }, (_, index) => <div key={index} className="rounded border border-slate-200 border-t-[#b18b40] bg-slate-50 p-1.5">
                  <div className="h-1 w-5 rounded-sm bg-slate-300" />
                  <div className="mt-2 h-2 w-full rounded-sm bg-slate-700/80" />
                </div>)}
              </div>
              <div className="mt-3 h-1 w-full rounded-sm bg-slate-200" />
              <div className="mt-1.5 h-1 w-3/4 rounded-sm bg-slate-200" />
              <div className="mt-auto flex items-center justify-between border-t border-slate-200 pt-2 text-[6px] text-slate-500">
                <span>GrowthLab</span><span>01</span>
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-xs leading-5">
              <p className="break-words font-medium text-slate-200">{reportTitle}</p>
              <p className="break-words text-slate-400">{clientName}</p>
              <p className="mt-2 flex items-center gap-1.5 text-[#edd27b]">
                <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
                {t("reviewedCount", { count: reviewedCount })}
              </p>
              <p className="text-slate-500">{t("version", { number: versionNumber })}</p>
            </div>
          </aside>

          <div className="min-w-0 space-y-5">
            <div className="grid gap-4 min-[460px]:grid-cols-2 sm:grid-cols-1 md:grid-cols-2">
              <fieldset disabled={pending} className="min-w-0">
                <legend className="mb-2 text-xs font-medium text-slate-200">{t("language")}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["en", "ar"] as const).map((language) => (
                    <label key={language} className="relative cursor-pointer">
                      <input type="radio" name="export-language" value={language} checked={exportLocale === language} onChange={() => setOptions((current) => ({ ...current, locale: language }))} className="peer sr-only" />
                      <span className="flex h-10 items-center justify-center rounded-xl border border-white/10 bg-black/10 px-2 text-xs text-slate-400 transition-colors peer-checked:border-[#edd27b]/45 peer-checked:bg-[#edd27b]/[0.09] peer-checked:text-[#f3d98b] peer-focus-visible:ring-2 peer-focus-visible:ring-[#edd27b]/60 peer-disabled:opacity-50">{language === "ar" ? "العربية" : "English"}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset disabled={pending} className="min-w-0">
                <legend className="mb-2 text-xs font-medium text-slate-200">{t("pageSize")}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["A4", "LETTER"] as const).map((size) => (
                    <label key={size} className="relative cursor-pointer">
                      <input type="radio" name="export-page-size" value={size} checked={pageSize === size} onChange={() => setOptions((current) => ({ ...current, pageSize: size }))} className="peer sr-only" />
                      <span className="flex h-10 items-center justify-center rounded-xl border border-white/10 bg-black/10 px-2 text-xs text-slate-400 transition-colors peer-checked:border-[#edd27b]/45 peer-checked:bg-[#edd27b]/[0.09] peer-checked:text-[#f3d98b] peer-focus-visible:ring-2 peer-focus-visible:ring-[#edd27b]/60 peer-disabled:opacity-50">{size === "A4" ? "A4" : t("letter")}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <fieldset disabled={pending}>
              <legend className="text-xs font-medium text-slate-200">{t("sections")}</legend>
              <p className="mt-1 text-xs leading-5 text-slate-500">{t("alwaysIncluded")}</p>
              <div className="mt-3 space-y-2">
                {reportPdfSections.map((key) => (
                  <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 transition-colors hover:border-[#edd27b]/25 hover:bg-white/[0.04]">
                    <Checkbox checked={options[key]} onChange={(event) => setOptions((current) => ({ ...current, [key]: event.target.checked }))} className="mt-0.5 border-white/25 checked:border-[#edd27b] checked:bg-[#edd27b] focus-visible:ring-[#edd27b]/40" />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-slate-200">{t(key)}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">{t(`${key}Hint`)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-white/[0.07] bg-black/10 p-3 text-xs leading-5 text-slate-400">
          <p className="flex items-start gap-2"><CheckCheck className="mt-0.5 size-3.5 shrink-0 text-[#edd27b]/80" aria-hidden /><span>{t("savedNotice")}</span></p>
          <p className="flex items-start gap-2"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /><span>{t("languageNotice")}</span></p>
          {status === "archived" && <p className="text-slate-300">{t("archivedNotice")}</p>}
          {status !== "published" && status !== "archived" && <p className="text-amber-200/90">{t("draftNotice")}</p>}
          {pendingReview > 0 && <p className="text-amber-200/90">{t("reviewNotice", { count: pendingReview })}</p>}
          {reviewedCount === 0 && <p className="text-amber-200/90">{t("noMetrics")}</p>}
        </div>

        <div aria-live="polite" aria-atomic="true">
          {pending && <p role="status" className="text-xs text-[#edd27b]">{t("preparingHint")}</p>}
          {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.07] p-3 text-sm text-red-200">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => changeOpen(false)} className="px-4">{t("cancel")}</Button>
          <Button type="button" disabled={pending || Boolean(unavailable)} onClick={() => void downloadReport()} className="button-primary gap-2 px-5 font-semibold" aria-busy={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowDownToLine className="size-4" aria-hidden />}
            {pending ? t("preparing") : t("download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

