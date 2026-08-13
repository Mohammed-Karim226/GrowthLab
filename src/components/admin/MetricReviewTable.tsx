"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiRequestError, apiDelete, apiPatch } from "@/lib/api-client";
import { formatDate, formatMetricValue, formatPercent, humanizeMetricName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import type { MetricRow, MetricSource, Platform } from "@/types/database";
import { PLATFORMS } from "@/types/database";

export type ReviewMetric = {
  id: string;
  platform: Platform;
  accountName: string | null;
  metricName: string;
  metricValue: number | null;
  metricUnit: string;
  metricDate: string | null;
  source: MetricSource;
  confidence: number | null;
  needsReview: boolean;
  note: string | null;
};

/** Below this the model told us it was guessing, so the row is called out. */
const LOW_CONFIDENCE = 0.7;

const SOURCE_LABEL: Record<MetricSource, "sourceAi" | "sourceManual" | "sourceCalculated" | "sourceImported"> =
  {
    ai: "sourceAi",
    manual: "sourceManual",
    calculated: "sourceCalculated",
    imported: "sourceImported",
  };

/**
 * The review step between extraction and approval.
 *
 * Every row starts flagged, and approval is blocked until none are (plan §30).
 * Edits go through PATCH /api/admin/metrics/[id], which is what re-stamps the
 * row as manual — this component never decides that itself.
 */
export default function MetricReviewTable({
  locale,
  metrics,
  locked,
}: {
  locale: Locale;
  metrics: ReviewMetric[];
  locked: boolean;
}) {
  const t = useTranslations("admin.review");
  const tPlatforms = useTranslations("platforms");

  // Server props stay the source of truth; local entries only cover the gap
  // between a successful write and the refreshed render.
  const [patched, setPatched] = useState<Record<string, ReviewMetric>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const rows = useMemo(
    () =>
      metrics
        .filter((metric) => !removed.includes(metric.id))
        .map((metric) => patched[metric.id] ?? metric),
    [metrics, patched, removed]
  );

  const pending = rows.filter((row) => row.needsReview).length;
  const visible = flaggedOnly ? rows.filter((row) => row.needsReview) : rows;

  const grouped = PLATFORMS.map((platform) => ({
    platform,
    rows: visible.filter((row) => row.platform === platform),
  })).filter((group) => group.rows.length > 0);

  function applyPatch(metric: ReviewMetric) {
    setPatched((current) => ({ ...current, [metric.id]: metric }));
  }

  function applyRemoval(id: string) {
    setRemoved((current) => [...current, id]);
  }

  if (metrics.length === 0) {
    return (
      <section className="space-y-3">
        <Header title={t("title")} hint={t("hint")} />
        <p className="rounded-xl border border-border/60 bg-card/40 px-4 py-6 text-center text-sm text-slate-400">
          {t("empty")}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <Header title={t("title")} hint={t("hint")} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={cn("text-sm", pending > 0 ? "text-amber-200" : "text-emerald-300")}>
          {pending > 0
            ? t("pending", { count: pending, total: rows.length })
            : t("allReviewed", { total: rows.length })}
        </p>

        {pending > 0 && (
          <Button variant="outline" size="sm" onClick={() => setFlaggedOnly((value) => !value)}>
            {flaggedOnly ? t("showAll") : t("showFlagged")}
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {grouped.map((group) => (
          <div key={group.platform} className="space-y-2">
            <h3 className="text-sm font-medium text-slate-300">{tPlatforms(group.platform)}</h3>

            <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("metric")}</TableHead>
                    <TableHead className="text-end">{t("value")}</TableHead>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("source")}</TableHead>
                    <TableHead className="text-end">{t("confidence")}</TableHead>
                    <TableHead className="w-px" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.rows.map((row) => (
                    <MetricRowView
                      key={row.id}
                      row={row}
                      locale={locale}
                      locked={locked}
                      onPatched={applyPatch}
                      onRemoved={applyRemoval}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Header({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="space-y-1.5">
      <h2 className="font-satoshi text-lg text-white">{title}</h2>
      <p className="text-sm text-slate-400">{hint}</p>
    </div>
  );
}

function MetricRowView({
  row,
  locale,
  locked,
  onPatched,
  onRemoved,
}: {
  row: ReviewMetric;
  locale: Locale;
  locked: boolean;
  onPatched: (metric: ReviewMetric) => void;
  onRemoved: (id: string) => void;
}) {
  const t = useTranslations("admin.review");
  const tErrors = useTranslations("admin.errors");
  const tMetrics = useTranslations("metrics");
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.metricValue === null ? "" : String(row.metricValue));

  const label = tMetrics.has(row.metricName as never)
    ? tMetrics(row.metricName as never)
    : humanizeMetricName(row.metricName);

  const lowConfidence = row.confidence !== null && row.confidence < LOW_CONFIDENCE;

  function reportError(error: unknown) {
    const key = error instanceof ApiRequestError ? error.errorKey : "serverError";
    toast.error(tErrors(key as never));
  }

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiPatch<{ metric: MetricRow }>(`/api/admin/metrics/${row.id}`, body),
    onSuccess: (data) => {
      onPatched({ ...toReviewMetric(data.metric), accountName: row.accountName });
      setEditing(false);
      toast.success(t("saved"));
      router.refresh();
    },
    onError: reportError,
  });

  const remove = useMutation({
    mutationFn: () => apiDelete<{ deleted: string }>(`/api/admin/metrics/${row.id}`),
    onSuccess: () => {
      onRemoved(row.id);
      toast.success(t("deleted"));
      router.refresh();
    },
    onError: reportError,
  });

  const busy = save.isPending || remove.isPending;

  function submitValue() {
    const trimmed = draft.trim();

    if (trimmed === "") {
      // An empty field means "not shown on the screenshot", not zero (plan §16).
      save.mutate({ metricValue: null });
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      toast.error(tErrors("validationFailed"));
      return;
    }

    save.mutate({ metricValue: parsed });
  }

  return (
    <TableRow className={cn(row.needsReview && "bg-amber-500/[0.04]")}>
      <TableCell className="text-slate-200">
        <span className="flex items-center gap-1.5">
          {label}
          {lowConfidence && (
            <span title={t("lowConfidence")}>
              <AlertTriangle className="size-3.5 text-amber-400" aria-label={t("lowConfidence")} />
            </span>
          )}
        </span>
        {row.accountName && <p className="mt-0.5 text-[11px] text-cyan-300/70">{row.accountName}</p>}
        {row.note && <p className="mt-0.5 text-xs text-slate-500">{row.note}</p>}
      </TableCell>

      <TableCell className="text-end tabular-nums text-slate-100">
        {editing ? (
          <span className="flex items-center justify-end gap-1">
            <Input
              type="number"
              step="any"
              value={draft}
              autoFocus
              disabled={busy}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitValue();
                if (event.key === "Escape") setEditing(false);
              }}
              className="h-8 w-28 text-end"
              aria-label={t("editValue")}
            />
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={submitValue}
              disabled={busy}
              aria-label={t("markReviewed")}
            >
              {save.isPending ? <Loader2 className="animate-spin" /> : <Check />}
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                setDraft(row.metricValue === null ? "" : String(row.metricValue));
                setEditing(false);
              }}
              disabled={busy}
              aria-label={t("editValue")}
            >
              <X />
            </Button>
          </span>
        ) : (
          formatMetricValue(row.metricValue, row.metricUnit, locale)
        )}
      </TableCell>

      <TableCell className="whitespace-nowrap text-xs text-slate-400">
        {formatDate(row.metricDate, locale)}
      </TableCell>

      <TableCell>
        <Badge variant={row.source === "manual" ? "default" : "outline"}>
          {t(SOURCE_LABEL[row.source])}
        </Badge>
      </TableCell>

      <TableCell className="text-end text-xs tabular-nums">
        <span className={lowConfidence ? "text-amber-300" : "text-slate-400"}>
          {row.confidence === null ? "—" : formatPercent(row.confidence * 100, locale)}
        </span>
      </TableCell>

      <TableCell>
        {!locked && !editing && (
          <span className="flex items-center justify-end gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setEditing(true)}
              disabled={busy}
              aria-label={t("editValue")}
              title={t("editValue")}
            >
              <Pencil />
            </Button>

            <Button
              size="sm"
              variant={row.needsReview ? "outline" : "ghost"}
              onClick={() => save.mutate({ needsReview: !row.needsReview })}
              disabled={busy}
            >
              {save.isPending && <Loader2 className="animate-spin" />}
              {row.needsReview ? t("markReviewed") : t("reflag")}
            </Button>

            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                if (window.confirm(t("deleteConfirm"))) remove.mutate();
              }}
              disabled={busy}
              aria-label={t("deleteMetric")}
              title={t("deleteMetric")}
              className="text-slate-500 hover:text-destructive"
            >
              {remove.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            </Button>
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}

/** Map the API's snake_case row onto the shape this table renders. */
function toReviewMetric(metric: MetricRow): ReviewMetric {
  return {
    id: metric.id,
    platform: metric.platform,
    accountName: null,
    metricName: metric.metric_name,
    metricValue: metric.metric_value,
    metricUnit: metric.metric_unit,
    metricDate: metric.metric_date,
    source: metric.source,
    confidence: metric.confidence,
    needsReview: metric.needs_review,
    note: metric.note,
  };
}
