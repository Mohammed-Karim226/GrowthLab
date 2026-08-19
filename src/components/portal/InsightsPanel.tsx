"use client";

import { AlertCircle, ArrowRight, Lightbulb, Sparkles, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

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
  const tUi = useTranslations("portal.ui");

  const reduceMotion = useReducedMotion();
  const groups = [
    { key: "wentWell", icon: TrendingUp, items: aiSummary?.went_well ?? [], color: "text-[#62dcb5]", bg: "bg-[#54d8ac]/10" },
    { key: "whatChanged", icon: ArrowRight, items: aiSummary?.what_changed ?? [], color: "text-[#a9a4ff]", bg: "bg-[#8d87f5]/10" },
    { key: "needsAttention", icon: AlertCircle, items: aiSummary?.needs_attention ?? [], color: "text-[#ef9978]", bg: "bg-[#ed8f6d]/10" },
    { key: "recommendations", icon: Lightbulb, items: aiSummary?.recommendations ?? [], color: "text-[#e2c87e]", bg: "bg-[#d8be78]/10" },
  ].filter((group) => group.items.length > 0);

  const headline = aiSummary?.summary?.trim() || summary?.trim() || null;
  const isEmpty = !headline && groups.length === 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[9px] font-semibold tracking-[0.2em] text-[#b9a363] uppercase">
            <Sparkles className="size-3.5" aria-hidden />
            {tUi("executiveIntelligence")}
          </p>
          <h2 className="mt-1 font-satoshi text-xl tracking-[-0.03em] text-[#f2efe7]">{t("title")}</h2>
        </div>
        <p className="max-w-lg text-[11px] leading-relaxed text-[#77766f]">{t("hint")}</p>
      </div>

      {isEmpty ? (
        <p className="rounded-2xl border border-dashed border-white/[0.08] bg-black/10 px-4 py-10 text-center text-sm text-[#77766f]">
          {t("empty")}
        </p>
      ) : (
        <div className="portal-insights relative overflow-hidden rounded-[32px] border border-white/[0.14] p-5 sm:p-7">
          <div aria-hidden className="absolute -top-32 start-1/3 size-72 rounded-full bg-[#d8be78]/[0.055] blur-[100px]" />
          {headline && (
            <div className="relative mb-7 overflow-hidden rounded-[24px] border border-white/[0.1] bg-white/[0.055] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.13)] sm:p-6">
              <Sparkles className="absolute end-5 top-5 size-5 text-[#d8c27c]/40" aria-hidden />
              <p className="max-w-5xl text-base leading-8 whitespace-pre-line text-[#d8d4c9] sm:text-lg sm:leading-9">
                {headline}
              </p>
            </div>
          )}

          {groups.length > 0 && (
            <div className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {groups.map((group, groupIndex) => {
                const Icon = group.icon;
                return (
                  <motion.div
                    key={group.key}
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ duration: 0.42, delay: groupIndex * 0.06 }}
                    className="group relative overflow-hidden rounded-[24px] border border-white/[0.11] bg-white/[0.045] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_20px_45px_rgba(0,0,0,.14)] backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-white/[0.18] hover:bg-white/[0.07]"
                  >
                    <div aria-hidden className={cn("absolute -end-10 -top-10 size-28 rounded-full opacity-50 blur-3xl", group.bg)} />
                    <span className={cn("relative mb-5 flex size-12 items-center justify-center rounded-[17px] border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_12px_30px_rgba(0,0,0,.18)]", group.bg, group.color)}>
                      <Icon className="size-5" strokeWidth={1.65} aria-hidden />
                    </span>
                    <h3 className="mb-3 text-[10px] font-semibold tracking-[0.12em] text-[#aaa69c] uppercase">
                      {t(group.key as never)}
                    </h3>
                    <ul className="space-y-2.5">
                      {group.items.map((item, index) => (
                        <li
                          key={`${group.key}-${index}`}
                          className="flex gap-2.5 text-xs leading-relaxed text-[#918f87]"
                        >
                          <span aria-hidden className={cn("mt-1.5 size-1 shrink-0 rounded-full", group.bg, group.color)} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
