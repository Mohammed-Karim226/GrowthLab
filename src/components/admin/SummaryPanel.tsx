"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { Check, Loader2, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, apiPatch, apiPost } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { AiSummaryPayload } from "@/types/database";

type EditableSummary = Omit<AiSummaryPayload, "generated_at">;
type SummaryListKey = Exclude<keyof EditableSummary, "summary">;

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
  const [draft, setDraft] = useState<EditableSummary | null>(null);

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

  const save = useMutation({
    mutationFn: (value: EditableSummary) =>
      apiPatch<{ aiSummary: AiSummaryPayload; status: string }>(
        `/api/admin/reports/${reportId}/summary`,
        { reportVersionId, summary: value }
      ),
    onSuccess: (data) => {
      setCurrent(data.aiSummary);
      setDraft(null);
      toast.success(t(data.status === "needs_review" ? "summarySavedReview" : "summarySaved"));
      router.refresh();
    },
    onError: (error) => {
      const key = error instanceof ApiRequestError ? error.errorKey : "serverError";
      toast.error(tErrors(key as never));
    },
  });

  const busy = mutation.isPending || save.isPending;
  const editing = draft !== null;

  function startEditing() {
    if (!current) return;
    const { generated_at: _generatedAt, ...editable } = current;
    setDraft(editable);
  }

  function updateList(key: SummaryListKey, index: number, value: string) {
    setDraft((existing) => {
      if (!existing) return existing;
      const items = [...existing[key]];
      items[index] = value;
      return { ...existing, [key]: items };
    });
  }

  function removeListItem(key: SummaryListKey, index: number) {
    setDraft((existing) => existing
      ? { ...existing, [key]: existing[key].filter((_, itemIndex) => itemIndex !== index) }
      : existing);
  }

  function addListItem(key: SummaryListKey) {
    setDraft((existing) => existing && existing[key].length < 6
      ? { ...existing, [key]: [...existing[key], ""] }
      : existing);
  }

  function submitDraft() {
    if (!draft) return;
    save.mutate({
      ...draft,
      summary: draft.summary.trim(),
      went_well: cleanItems(draft.went_well),
      what_changed: cleanItems(draft.what_changed),
      needs_attention: cleanItems(draft.needs_attention),
      recommendations: cleanItems(draft.recommendations),
    });
  }

  return (
    <Card className="liquid-card border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-sm text-white">{t("summary")}</CardTitle>
          <p className="text-xs text-slate-500">{t("summaryHint")}</p>
        </div>

        {!locked && !editing && (
          <div className="flex flex-wrap gap-2">
            {current && (
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={startEditing}>
                <Pencil className="size-3.5" aria-hidden />
                {t("editSummary")}
              </Button>
            )}
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
              {mutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-3.5" aria-hidden />
              )}
              {mutation.isPending
                ? t("generatingSummary")
                : current
                  ? t("regenerateSummary")
                  : t("generateSummary")}
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {editing && draft ? (
          <div className="space-y-5">
            <label className="block space-y-2 text-xs font-medium text-slate-300">
              <span>{t("executiveSummary")}</span>
              <Textarea
                rows={5}
                maxLength={2000}
                value={draft.summary}
                onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
                className="min-h-32 resize-y border-white/10 bg-black/10 leading-relaxed"
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <SummaryListEditor title={t("wentWell")} listKey="went_well" items={draft.went_well} onChange={updateList} onRemove={removeListItem} onAdd={addListItem} addLabel={t("addInsight")} removeLabel={t("removeInsight")} />
              <SummaryListEditor title={t("whatChanged")} listKey="what_changed" items={draft.what_changed} onChange={updateList} onRemove={removeListItem} onAdd={addListItem} addLabel={t("addInsight")} removeLabel={t("removeInsight")} />
              <SummaryListEditor title={t("needsAttention")} listKey="needs_attention" items={draft.needs_attention} onChange={updateList} onRemove={removeListItem} onAdd={addListItem} addLabel={t("addInsight")} removeLabel={t("removeInsight")} />
              <SummaryListEditor title={t("recommendations")} listKey="recommendations" items={draft.recommendations} onChange={updateList} onRemove={removeListItem} onAdd={addListItem} addLabel={t("addInsight")} removeLabel={t("removeInsight")} />
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.06] pt-4">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setDraft(null)}>
                <X aria-hidden />
                {t("cancelEdit")}
              </Button>
              <Button type="button" disabled={busy || !draft.summary.trim()} onClick={submitDraft}>
                {save.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                {save.isPending ? t("savingSummary") : t("saveSummary")}
              </Button>
            </div>
          </div>
        ) : !current ? (
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

function cleanItems(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean);
}

function SummaryListEditor({
  title,
  listKey,
  items,
  onChange,
  onRemove,
  onAdd,
  addLabel,
  removeLabel,
}: {
  title: string;
  listKey: SummaryListKey;
  items: string[];
  onChange: (key: SummaryListKey, index: number, value: string) => void;
  onRemove: (key: SummaryListKey, index: number) => void;
  onAdd: (key: SummaryListKey) => void;
  addLabel: string;
  removeLabel: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-slate-400">{title}</legend>
      {items.map((item, index) => (
        <div key={`${listKey}-${index}`} className="flex items-start gap-2">
          <Input
            value={item}
            maxLength={400}
            onChange={(event) => onChange(listKey, index, event.target.value)}
            className="border-white/10 bg-black/10"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="shrink-0 text-slate-500 hover:text-red-300"
            onClick={() => onRemove(listKey, index)}
            aria-label={removeLabel}
            title={removeLabel}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      ))}
      {items.length < 6 && (
        <Button type="button" size="sm" variant="ghost" onClick={() => onAdd(listKey)}>
          <Plus className="size-3.5" aria-hidden />
          {addLabel}
        </Button>
      )}
    </fieldset>
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
