"use client";

import SectionReveal from "@/components/home/SectionReveal";
import { cardMeta, type SectionCard } from "@/lib/landing";
import { useTranslations } from "next-intl";

type ProblemSectionProps = {
  problems: SectionCard[];
};

export default function ProblemSection({ problems }: ProblemSectionProps) {
  const t = useTranslations("problem");

  return (
    <section id="problem" className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionReveal>
          <div className="text-center mb-14">
            <p className="text-[#0891B2] text-sm font-semibold uppercase tracking-widest mb-3">
              {t("badge")}
            </p>
            <h2 className="font-satoshi text-3xl sm:text-4xl lg:text-5xl text-white mb-4">
              {t("titleLine1")}{" "}
              <span className="gradient-text-gold">{t("titleHighlight")}</span>
            </h2>
            <p className="mx-auto max-w-2xl text-base text-slate-400">
              {t("description")}
            </p>
          </div>
        </SectionReveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {problems.map((item, index) => (
            <SectionReveal key={index} delay={index * 0.1}>
              <div className="group card-hover-glow relative h-full rounded-3xl border border-white/10 bg-[#0D1235]/90 p-6">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(circle at 10% 10%, ${cardMeta[index % cardMeta.length].hoverBg}, transparent 35%)`,
                  }}
                />
                <div className="relative z-10">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <span
                      className={`rounded-full border ${cardMeta[index % cardMeta.length].badge} bg-slate-900/70 px-3 py-1 text-[0.625rem] uppercase tracking-[0.28em]`}
                    >
                      {t("issuePrefix")} {index + 1}
                    </span>
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-3xl bg-[#08102a]/80 transition-transform duration-300 group-hover:scale-110 ${cardMeta[index % cardMeta.length].icon}`}
                    >
                      {item.icon}
                    </div>
                  </div>

                  <h3 className="text-white font-semibold text-lg mb-3">
                    {t(`items.${index}.title`)}
                  </h3>
                  <p className="min-h-16 text-sm leading-relaxed text-slate-400">
                    {t(`items.${index}.desc`)}
                  </p>

                  <div className="mt-6 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                    <span
                      className={`inline-flex h-2 w-2 rounded-full ${cardMeta[index % cardMeta.length].dot}`}
                    />
                    {t(`callouts.${index}`)}
                  </div>
                </div>
              </div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
