import type { Locale } from "@/lib/i18n";

/**
 * Locale-aware display helpers.
 *
 * Every function takes `null` and returns a dash rather than inventing a value —
 * a missing metric must never render as 0 (plan §16).
 */

const NOT_AVAILABLE = "—";

export function formatNumber(
  value: number | null | undefined,
  locale: Locale,
  options?: Intl.NumberFormatOptions
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NOT_AVAILABLE;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2, ...options }).format(value);
}

export function formatCompact(value: number | null | undefined, locale: Locale): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NOT_AVAILABLE;
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, locale: Locale): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NOT_AVAILABLE;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`;
}

/** Signed percentage for growth badges. Null stays a dash, never "0%". */
export function formatSignedPercent(value: number | null | undefined, locale: Locale): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NOT_AVAILABLE;
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value);
  return `${formatted}%`;
}

export function formatDuration(seconds: number | null | undefined, locale: Locale): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return NOT_AVAILABLE;
  if (seconds < 60) return `${formatNumber(Math.round(seconds), locale)}s`;

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}m ${remainder}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/** Format a metric using its stored unit so percentages never read as counts. */
export function formatMetricValue(
  value: number | null | undefined,
  unit: string,
  locale: Locale
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NOT_AVAILABLE;

  switch (unit) {
    case "percent":
      return formatPercent(value, locale);
    case "seconds":
      return formatDuration(value, locale);
    case "minutes":
      return formatDuration(value * 60, locale);
    case "hours":
      return formatDuration(value * 3600, locale);
    default:
      return formatNumber(value, locale);
  }
}

/**
 * Readable label for a metric the translations do not cover.
 *
 * The model may return a platform-specific name outside our vocabulary, and
 * renaming it to fit a known bucket would misreport what the screenshot said
 * (plan §16). Show it as-is instead.
 */
export function humanizeMetricName(name: string): string {
  const spaced = name.replace(/_/g, " ").trim();
  if (spaced.length === 0) return NOT_AVAILABLE;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** `YYYY-MM-DD` (or an ISO timestamp) as a medium-length localised date. */
export function formatDate(value: string | null | undefined, locale: Locale): string {
  if (!value) return NOT_AVAILABLE;
  const parsed = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(parsed)) return NOT_AVAILABLE;

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
  locale: Locale
): string {
  const from = formatDate(start, locale);
  const to = formatDate(end, locale);
  if (from === NOT_AVAILABLE && to === NOT_AVAILABLE) return NOT_AVAILABLE;
  return `${from} – ${to}`;
}

export function formatFileSize(bytes: number | null | undefined, locale: Locale): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return NOT_AVAILABLE;
  if (bytes < 1024) return `${bytes} B`;

  const kb = bytes / 1024;
  if (kb < 1024) return `${formatNumber(kb, locale, { maximumFractionDigits: 0 })} KB`;

  return `${formatNumber(kb / 1024, locale, { maximumFractionDigits: 1 })} MB`;
}
