"use client";

import { AlertCircle, ArrowRight, Lightbulb, Sparkles, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

import type { AiSummaryPayload } from "@/types/database";

/**
 * The written read-out for a period.
 *
 * Renders only the validated `ai_summary` payload an admin reviewed and
 * published — never a raw model response, and never anything generated at read
 * time (plan §17). Empty lists are dropped rather than shown as empty headings.
 */
export default function InsightsPanel({
  summary,
  aiSummary,
}: {
  summary: string | null;
  aiSummary: AiSummaryPayload | null;
}) {
  const t = useTranslations("portal.insights");

  const groups = [
    { key: "wentWell", icon: TrendingUp, items: aiSummary?.went_well ?? [] },
    { key: "whatChanged", icon: ArrowRight, items: aiSummary?.what_changed ?? [] },
    { key: "needsAttention", icon: AlertCircle, items: aiSummary?.needs_attention ?? [] },
    { key: "recommendations", icon: Lightbulb, items: aiSummary?.recommendations ?? [] },
  ].filter((group) => group.items.length > 0);

  const headline = aiSummary?.summary?.trim() || summary?.trim() || null;
  const isEmpty = !headline && groups.length === 0;

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 font-satoshi text-base text-white">
          <Sparkles className="size-4 text-slate-400" aria-hidden />
          {t("title")}
        </h2>
        <p className="text-xs text-slate-400">{t("hint")}</p>
      </div>

      {isEmpty ? (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">
          {t("empty")}
        </p>
      ) : (
        <div className="space-y-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          {headline && (
            <p className="text-sm leading-relaxed whitespace-pre-line text-slate-200">{headline}</p>
          )}

          {groups.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {groups.map((group) => {
                const Icon = group.icon;
                return (
                  <div key={group.key} className="space-y-2">
                    <h3 className="flex items-center gap-2 text-xs tracking-wide text-slate-500 uppercase">
                      <Icon className="size-3.5" aria-hidden />
                      {t(group.key as never)}
                    </h3>
                    <ul className="space-y-1.5">
                      {group.items.map((item, index) => (
                        <li
                          key={`${group.key}-${index}`}
                          className="flex gap-2 text-sm leading-relaxed text-slate-300"
                        >
                          <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-slate-600" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
