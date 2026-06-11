"use client";

import SectionReveal from "@/components/home/SectionReveal";
import type { BenefitCard } from "@/lib/landing";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";

type BenefitsSectionProps = {
  benefits: BenefitCard[];
};

const BenefitsSection = ({ benefits }: BenefitsSectionProps) => {
 
  const t = useTranslations("benefits");
  return (
    <section
      id="benefits"
      className="relative py-28 lg:py-40 overflow-hidden bg-[#0A0A1F]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(103,232,249,0.18)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(34,211,238,0.15)_0%,transparent_65%)]" />
      <div className="absolute inset-0 bg-grid-white/[0.035] bg-size:[60px_60px]" />

      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
        <SectionReveal>
          <div className="text-center mb-20">
            <div className="mx-auto mb-6 inline-flex items-center gap-2.5 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-8 py-2.5 text-xs font-mono font-medium tracking-[3px] text-cyan-300">
              {t("badge")}
            </div>

            <h2 className="font-satoshi text-6xl sm:text-7xl max-sm:text-3xl lg:text-[5.2rem] leading-[1.02] max-sm:leading-[1.4] font-semibold text-white">
              {t("titleLine1")}{" "}
              <span className="bg-linear-to-br from-[#67E8F9] via-[#22D3EE] to-[#06B6D4] bg-clip-text text-transparent">
                {t("titleHighlight")}
              </span>
            </h2>

            <p className="mt-8 text-xl text-slate-400 leading-relaxed w-full max-sm:text-base">
              {t("descriptionLine1")} <br />
              {t("descriptionLine2")}
            </p>
          </div>
        </SectionReveal>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit, index) => (
            <BenefitCard key={benefit.title} benefit={benefit} index={index} />
          ))}
        </div>

        <SectionReveal delay={0.5}>
          <div className="text-center mt-20">
            <p className="text-sm font-mono uppercase tracking-[4px] text-cyan-400/60 max-sm:text-xs">
             {t("footerText")}
            </p>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
};

const BenefitCard = ({
  benefit,
  index,
}: {
  benefit: BenefitCard;
  index: number;
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-100, 100], [15, -15]);
  const rotateY = useTransform(x, [-100, 100], [-15, 15]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * 0.3);
    y.set((e.clientY - rect.top - rect.height / 2) * 0.3);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };
   const locale = useLocale();
  const isRTL = locale === "ar";
  const t = useTranslations("benefits");
  return (
    <SectionReveal delay={index * 0.1}>
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        whileHover={{
          scale: 1.04,
          transition: { duration: 2, ease: "backOut" },
        }}
        className="group relative h-full rounded-3xl border border-white/5 bg-[#0F162E]/95 p-9 lg:p-10 backdrop-blur-2xl overflow-hidden cursor-pointer"
      >
        <div
          className="absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 40% 30%, ${benefit.color}25, transparent 70%)`,
          }}
        />

        <motion.div
          className="relative mb-8 flex h-20 w-20 items-center justify-center rounded-3xl"
          style={{
            background: `linear-gradient(145deg, ${benefit.color}15, transparent)`,
            border: `2px solid ${benefit.color}30`,
            boxShadow: `0 0 40px -10px ${benefit.color}60`,
          }}
          whileHover={{
            rotate: 18,
            scale: 1.22,
            transition: { duration: 3, ease: "backOut" },
          }}
        >
          <motion.div
            className="text-5xl drop-shadow-xl"
            whileHover={{ scale: 1.2, rotate: -8 }}
            transition={{ duration: 0.4 }}
          >
            {benefit.icon}
          </motion.div>

          <div className="absolute inset-0 rounded-3xl border border-cyan-400/20 animate-pulse" />
        </motion.div>

        <h3 className="text-3xl font-semibold text-white mb-4 tracking-[-0.02em]">
          {t(`items.${index}.title`)}
        </h3>

        <p className="text-slate-400 text-[15.8px] leading-relaxed mb-8">
          {t(`items.${index}.desc`)}
        </p>

        <a href="#contact" className="flex items-center gap-2 text-cyan-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
          {t("unlock")}
          <span className="text-xl transition-transform group-hover:translate-x-1">
            {isRTL ? "←" : "→"}
          </span>
        </a>

        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-linear-to-r from-transparent via-cyan-400 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left" />

        <div className="absolute top-6 right-6 h-5 w-5 border-t-2 border-r-2 border-cyan-400/50 rounded-tr-2xl opacity-0 group-hover:opacity-100 transition-all duration-500" />
        <div className="absolute bottom-6 left-6 h-5 w-5 border-b-2 border-l-2 border-cyan-400/50 rounded-bl-2xl opacity-0 group-hover:opacity-100 transition-all duration-500" />

        <div className="absolute inset-0 bg-linear-to-b from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-30 pointer-events-none transition-opacity duration-700" />
      </motion.div>
    </SectionReveal>
  );
};

export default BenefitsSection;
