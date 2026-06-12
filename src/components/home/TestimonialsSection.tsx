"use client";

import SectionReveal from "@/components/home/SectionReveal";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFacebook,
  faInstagram,
  faTiktok,
  faYoutube,
} from "@fortawesome/free-brands-svg-icons";
import type { Testimonial } from "@/lib/landing";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

type TestimonialsSectionProps = {
  testimonials: Testimonial[];
};

export default function TestimonialsSection({
  testimonials,
}: TestimonialsSectionProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const locale = useLocale();
  const isRTL = locale === "ar";

  const t = useTranslations("testimonials");

  // Only real testimonials
  const realTestimonials = testimonials.slice(0, 2);

  // Predefined static rotation values (no Math.random() to avoid hydration errors)
  const rotations = [-3, 5, -7, 4, -2, 6];
  // Background floating cards (cycle through real ones)
  const floatingCards = Array.from({ length: 6 }, (_, i) => ({
    ...realTestimonials[i % realTestimonials.length],
    id: i,
    delay: i * 0.8,
    xOffset: (i % 3) * 180 - 180, // spread horizontally
    rotation: rotations[i % rotations.length],
  }));

  // Auto-rotate for main cards
  useEffect(() => {
    if (realTestimonials.length === 0) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) =>
        prev === null ? 0 : (prev + 1) % realTestimonials.length
      );
    }, 4800);
    return () => clearInterval(interval);
  }, [realTestimonials.length]);

  return (
    <section
      id="testimonials"
      className="relative py-20 overflow-hidden bg-[#05070F]"
    >
      {/* Background Effects + Floating Cards */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#0891B2_0.8px,transparent_1px)] [background-size:40px_40px] animate-[pulse_12s_ease-in-out_infinite]" />
        
        {/* Floating Background Cards */}
        {floatingCards.map((item, i) => {
          const idx = i % realTestimonials.length;
          const nextRotation = item.rotation + 2;
          return (
            <motion.div
              key={item.id}
              initial={{
                opacity: 0.07,
                y: 100,
                x: item.xOffset,
                scale: 0.75,
                rotate: item.rotation,
              }}
              animate={{
                opacity: [0.06, 0.12, 0.06],
                y: [100, -180],
                x: [item.xOffset - 30, item.xOffset + 40],
                rotate: [item.rotation, nextRotation],
              }}
              transition={{
                duration: 28 + i * 3,
                repeat: Infinity,
                delay: item.delay,
                ease: "linear",
              }}
              className="absolute hidden lg:block w-[260px] bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 text-xs pointer-events-none"
              style={{
                left: isRTL ? "auto" : `${38 + (i % 4) * 18}%`,
                right: isRTL ? `${38 + (i % 4) * 18}%` : "auto",
                top: `${20 + Math.floor(i / 3) * 35}%`,
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="size-8 rounded-full overflow-hidden ring-1 ring-white/20">
                  <Image
                    src={item.avatar}
                    alt={item.name}
                    width={32}
                    height={32}
                    className="object-cover"
                  />
                </div>
                <div className="text-white/70 text-[13px]">
                  {t(`items.${idx}.name`)}
                </div>
              </div>
              <p className="italic text-slate-400 line-clamp-3 leading-snug">
                “{t(`items.${idx}.quote`).slice(0, 95)}...”
              </p>
            </motion.div>
          );
        })}

        {/* Glow Orbs */}
        <div className="absolute top-10 left-10 w-96 h-96 bg-[#F59E0B] rounded-full blur-[120px] opacity-20 animate-pulse" />
        <div className="absolute bottom-20 right-10 w-[32rem] h-[32rem] bg-[#22D3EE] rounded-full blur-[150px] opacity-20 animate-pulse delay-1000" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
        <SectionReveal>
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <p className="text-emerald-400 text-xs font-mono tracking-[3px] uppercase">
                {t("badge")}
              </p>
            </div>

            <h2 className="font-satoshi text-5xl max-sm:text-4xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tighter mb-6">
              {t("titleLine1")}{" "}
              <br />
              {t("titleLine2Prefix")}{" "}
              <span className="bg-linear-to-r from-[#F59E0B] via-[#22D3EE] to-[#A855F7] bg-clip-text text-transparent">
                {t("titleLine2Highlight")}
              </span>
              {t("titleLine2Suffix")}
            </h2>

            <p className="mx-auto max-w-lg text-lg text-slate-400">
              {t("description")}
            </p>
          </div>
        </SectionReveal>

        {/* Prominent Real Testimonials in Front */}
        <div className="grid gap-8 md:gap-10 grid-cols-1 md:grid-cols-2 mb-24 relative z-10">
          {realTestimonials.map((item, index) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 80, rotateX: -20 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.9,
                delay: index * 0.12,
                ease: [0.215, 0.61, 0.355, 1],
              }}
              whileHover={{
                y: -20,
                scale: 1.04,
                transition: { duration: 0.6, ease: "easeOut" },
              }}
              onHoverStart={() => setActiveIndex(index)}
              onHoverEnd={() => setActiveIndex(null)}
              className="cursor-pointer group relative rounded-3xl border border-white/10 bg-linear-to-br from-[#0D1235] to-[#0A0E27] p-9 overflow-hidden h-full flex flex-col shadow-2xl shadow-black/60 z-20"
            >
              <div className="absolute inset-0 bg-linear-to-br from-[#0891B2]/10 via-transparent to-[#F59E0B]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <div className="absolute top-0 left-0 right-0 h-[1px] bg-linear-to-r from-transparent via-[#0891B2] to-transparent" />

              <div className="mb-7 flex items-center gap-4">
                <div className="relative flex justify-center items-center size-16 rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-linear-to-br from-[#0891B2] to-[#F59E0B] rounded-3xl blur-xl opacity-40 group-hover:opacity-70 transition-all duration-500" />
                  <Image
                    src={item.avatar}
                    alt={item.name}
                    fill
                    className="object-cover rounded-full"
                    sizes="64px"
                  />
                </div>
                <div>
                  <p className="font-semibold text-2xl text-white tracking-tight">
                    {t(`items.${index}.name`)}
                  </p>
                  <p className="text-sm text-slate-400">{item.category}</p>
                </div>
              </div>

              <div className="flex-1 mb-9">
                <p className="text-slate-200 leading-relaxed text-[15.5px]">
                  “{t(`items.${index}.quote`)}”
                </p>
              </div>

              <div className="space-y-5 mb-9">
                <div className="flex items-center gap-4 text-sm">
                  <div className="w-9 h-9 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0 text-xl">📈</div>
                  <div>
                    <p className="text-emerald-400 text-xs font-mono">{t("growth")}</p>
                    <p className="text-white text-lg">{item.after}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="w-9 h-9 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0 text-xl">👥</div>
                  <div>
                    <p className="text-emerald-400 text-xs font-mono">{t("audience")}</p>
                    <p className="text-white text-lg">
                      {isRTL ? `${item.after} ← ${item.before}` : `${item.before} → ${item.after}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-auto">
                <div className="flex justify-between text-[10px] font-mono tracking-widest text-slate-500 mb-2">
                  <span>{t("before")}</span>
                  <span>{t("now")}</span>
                </div>
                <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: "38%" }}
                    whileInView={{ width: "94%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 2.2, delay: 0.5 + index * 0.2 }}
                    className="h-full bg-linear-to-r from-[#0891B2] via-[#22D3EE] to-[#F59E0B] rounded-full relative"
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_16px_#22D3EE] -mr-1.5" />
                  </motion.div>
                </div>
              </div>

              <div className={cn(
                "absolute bottom-6 right-6 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-4 py-1.5 rounded-2xl border border-emerald-500/40 text-xs font-mono text-emerald-400 z-30",
                isRTL && "left-6 right-auto"
              )}>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                <span>{t("verified")}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Scrolling Marquee */}
        <div className="mb-20">
          <p className="text-center text-slate-500 font-mono text-sm tracking-widest mb-6">{t("moreCreatorsTransformed")}</p>
          <div className="overflow-hidden">
            <div className={cn("flex gap-6 whitespace-nowrap py-3", isRTL ? "animate-marquee-rtl" : "animate-marquee")}>
              {[...Array.from({ length: 8 }), ...Array.from({ length: 8 })].map((_, i) => {
                const idx = i % realTestimonials.length;
                const item = realTestimonials[idx];
                return (
                  <div
                    key={i}
                    className="flex-shrink-0 bg-white/5 border border-white/10 rounded-2xl px-7 py-5 max-w-[340px] opacity-90"
                  >
                    <p className="text-sm text-slate-400 italic line-clamp-3">“{t(`items.${idx}.quote`).slice(0, 105)}...”</p>
                    <div className="mt-4 flex items-center gap-3">
                      <Image src={item.avatar} alt={t(`items.${idx}.name`)} width={36} height={36} className="rounded-full ring-1 ring-white/20" />
                      <div>
                        <p className="text-white text-sm">{t(`items.${idx}.name`)}</p>
                        <p className="text-emerald-400/80 text-xs">Verified</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Trusted Platforms */}
        <SectionReveal delay={0.4}>
          <div className="border-t border-white/10 pt-12">
            <p className="text-center text-slate-500 font-mono text-sm tracking-widest mb-10">
              {t("trustedByCreatorsOn")}
            </p>

            <div className="flex flex-wrap justify-center gap-x-12 gap-y-10">
              {[
                { name: "TikTok", icon: faTiktok, hoverBg: "hover:bg-[#69C9D0]/10", hoverTextClass: "group-hover:text-[#69C9D0]" },
                { name: "Instagram", icon: faInstagram, hoverBg: "hover:bg-[#E1306C]/10", hoverTextClass: "group-hover:text-[#E1306C]" },
                { name: "YouTube", icon: faYoutube, hoverBg: "hover:bg-[#FF0000]/10", hoverTextClass: "group-hover:text-[#FF0000]" },
                { name: "Facebook", icon: faFacebook, hoverBg: "hover:bg-[#1877F2]/10", hoverTextClass: "group-hover:text-[#1877F2]" },
              ].map((platform, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -10, scale: 1.15 }}
                  className="group flex flex-col items-center gap-4 cursor-pointer"
                >
                  <div className={`relative size-16 flex items-center justify-center bg-white/5 hover:bg-zinc-900 border border-white/10 rounded-3xl transition-all ${platform.hoverBg}`}>
                    <FontAwesomeIcon icon={platform.icon} className={`h-10 w-10 text-white transition-colors ${platform.hoverTextClass}`} />
                  </div>
                  <p className="text-sm text-slate-400 group-hover:text-white">{platform.name}</p>
                </motion.div>
              ))}
            </div>

            <p className="text-center text-[13px] text-slate-500 mt-14 font-light">
              {t("thousandsMore")}
            </p>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}