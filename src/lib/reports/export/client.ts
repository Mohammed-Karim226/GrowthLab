import type { ReportExportRequest } from "./contract";

export class ReportPdfDownloadError extends Error {
  constructor(public readonly errorKey: string, public readonly status = 0) {
    super(errorKey);
  }
}

export function reportPdfFilename(disposition: string | null): string {
  const fallback = "growthlab-report.pdf";
  if (!disposition) return fallback;
  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition)?.[1];
  let filename: string | undefined;
  try {
    filename = encoded ? decodeURIComponent(encoded.trim()) : /filename\s*=\s*(?:"([^"]+)"|([^;]+))/i.exec(disposition)?.slice(1).find(Boolean)?.trim();
  } catch {
    return fallback;
  }
  if (!filename) return fallback;
  const safe = filename.replace(/[\\/:*?"<>|]/g, "-").replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/^\.+/, "").trim();
  return safe.length > 4 && safe.length <= 180 && /\.pdf$/i.test(safe) ? safe : fallback;
}

/** Validate the actual bytes before offering a download, including proxy errors. */
export async function requestReportPdf(
  input: ReportExportRequest & { reportId: string },
  signal: AbortSignal,
): Promise<{ blob: Blob; filename: string }> {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  if (signal.aborted) cancel();
  signal.addEventListener("abort", cancel, { once: true });
  // Allow the server's 60-second render deadline plus response transfer time.
  const timeout = setTimeout(() => controller.abort(new ReportPdfDownloadError("timeout")), 75_000);
  try {
    const { reportId, ...body } = input;
    const response = await fetch(`/api/admin/reports/${encodeURIComponent(reportId)}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/pdf" },
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const errorKey = body && typeof body === "object" && "errorKey" in body && typeof body.errorKey === "string" ? body.errorKey
        : response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : response.status === 504 ? "timeout" : "error";
      throw new ReportPdfDownloadError(errorKey, response.status);
    }
    if (!response.headers.get("Content-Type")?.toLowerCase().startsWith("application/pdf")) {
      throw new ReportPdfDownloadError("invalidPdf");
    }
    const blob = await response.blob();
    const header = await blob.slice(0, 5).text();
    if (header !== "%PDF-") throw new ReportPdfDownloadError("invalidPdf");
    controller.signal.throwIfAborted();
    return { blob, filename: reportPdfFilename(response.headers.get("Content-Disposition")) };
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (controller.signal.aborted) throw controller.signal.reason;
    if (error instanceof ReportPdfDownloadError) throw error;
    throw new ReportPdfDownloadError("networkError");
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
  }
}

export function saveReportPdf(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Immediate revocation can cancel downloads in Safari and other browsers.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
