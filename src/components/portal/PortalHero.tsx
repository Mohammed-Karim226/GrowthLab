"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";

type PortalHeroProps = {
  eyebrow: string;
  title: string;
  period: string;
  publishedLabel: string;
  comparisonLabel: string;
  action?: { href: string; label: string };
  compact?: boolean;
};

export default function PortalHero({
  eyebrow,
  title,
  period,
  publishedLabel,
  comparisonLabel,
  action,
  compact = false,
}: PortalHeroProps) {
  const t = useTranslations("portal.ui");

  return (
    <header
      className={cn(
        "portal-hero portal-glass-panel portal-reveal relative overflow-hidden rounded-[34px] border border-white/[0.14]",
        compact ? "px-4 py-5 sm:px-7 sm:py-6" : "px-4 py-6 sm:px-8 sm:py-9 lg:px-10"
      )}
    >
      <div aria-hidden className="portal-hero-grid absolute inset-0 opacity-70" />
      <div aria-hidden className="absolute -top-24 -end-20 size-72 rounded-full bg-[#d8be78]/[0.08] blur-[90px]" />
      <div aria-hidden className="absolute -bottom-28 start-1/4 h-52 w-80 rounded-full bg-[#276650]/[0.08] blur-[90px]" />

      <div className="relative flex flex-col justify-between gap-8 xl:flex-row xl:items-end">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d8be78]/15 bg-[#d8be78]/[0.055] px-3 py-1.5 text-[10px] font-semibold tracking-[0.18em] text-[#d8c58e] uppercase">
            <span className="size-1.5 rounded-full bg-[#e0c878] shadow-[0_0_12px_rgba(224,200,120,0.7)]" />
            {eyebrow}
          </div>
          <h1
            className={cn(
              "max-w-[900px] font-satoshi leading-[1.02] tracking-[-0.045em] text-[#f6f2e9]",
              compact ? "text-[28px] sm:text-4xl" : "text-[30px] sm:text-5xl lg:text-[56px]"
            )}
          >
            {title}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-xs text-[#8f8d85]">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="size-3.5 text-[#c4aa6d]" strokeWidth={1.8} />
              {period}
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock3 className="size-3.5 text-[#77766f]" strokeWidth={1.8} />
              {publishedLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center xl:flex-col xl:items-end">
          {action && (
            <Link
              href={action.href}
              className="portal-gold-button group inline-flex h-12 items-center gap-2.5 rounded-full px-5 text-sm font-semibold text-[#17150f]"
            >
              <FileCheck2 className="size-4" strokeWidth={1.9} aria-hidden />
              {action.label}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" aria-hidden />
            </Link>
          )}
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.065] bg-black/15 px-3.5 py-3 backdrop-blur-md">
            <span className="flex size-9 items-center justify-center rounded-xl border border-[#54d8ac]/15 bg-[#54d8ac]/[0.07] text-[#67dcb7]">
              <CheckCircle2 className="size-[17px]" strokeWidth={1.8} aria-hidden />
            </span>
            <span>
              <span className="block text-[9px] font-semibold tracking-[0.16em] text-[#686861] uppercase">
                {t("comparisonStatus")}
              </span>
              <span className="mt-0.5 block text-xs text-[#c7c3b8]">{comparisonLabel}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="relative mt-8 flex flex-wrap gap-2.5 border-t border-white/[0.055] pt-5">
        {[t("reviewedData"), t("publishedReport"), t("privateAccess")].map((label, index) => {
          const Icon = index === 2 ? ShieldCheck : CheckCircle2;
          return (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.025] px-2.5 py-1 text-[9px] font-medium tracking-[0.08em] text-[#85837b] uppercase"
            >
              <Icon className="size-3 text-[#bca66e]" strokeWidth={1.8} />
              {label}
            </span>
          );
        })}
      </div>
    </header>
  );
}
