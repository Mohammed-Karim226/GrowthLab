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
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useLocale } from "next-intl";

type TestimonialsSectionProps = {
  testimonials: Testimonial[];
};

export default function TestimonialsSection({
  testimonials,
}: TestimonialsSectionProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const locale = useLocale();
  const isRTL = locale === "ar";
  return (
    <section
      id="testimonials"
      className="relative py-12 overflow-hidden bg-[#05070F]"
    >
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#0891B2_0.8px,transparent_1px)] [background-size:40px_40px] animate-[pulse_12s_ease-in-out_infinite]" />
        <div className="absolute top-10 left-10 w-96 h-96 bg-[#F59E0B] rounded-full blur-[120px] opacity-20 animate-pulse" />
        <div className="absolute bottom-20 right-10 w-[32rem] h-[32rem] bg-[#22D3EE] rounded-full blur-[150px] opacity-20 animate-pulse delay-1000" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
        <SectionReveal>
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <p className="text-emerald-400 text-xs font-mono tracking-[3px] uppercase">
                Proven Transformations
              </p>
            </div>

            <h2 className="font-satoshi text-5xl max-sm:text-4xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tighter mb-6">
              They didn&apos;t just grow.
              <br />
              They{" "}
              <span className="bg-linear-to-r from-[#F59E0B] via-[#22D3EE] to-[#A855F7] bg-clip-text text-transparent">
                exploded
              </span>
              .
            </h2>

            <p className="mx-auto max-w-lg text-lg text-slate-400">
              Real creators. Real numbers. Zero fluff.
            </p>
          </div>
        </SectionReveal>

        <div className="grid gap-6 md:gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((item, index) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 80, rotateX: -20 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.8,
                delay: index * 0.12,
                ease: [0.215, 0.61, 0.355, 1],
              }}
              whileHover={{
                y: -16,
                scale: 1.03,
                transition: { duration: 0.5, ease: "easeOut" },
              }}
              onHoverStart={() => setActiveIndex(index)}
              onHoverEnd={() => setActiveIndex(null)}
              className="cursor-pointer group relative rounded-3xl border border-white/10 bg-linear-to-br from-[#0D1235] to-[#0A0E27] p-8 overflow-hidden h-full flex flex-col z-10"
            >
              <div className="absolute inset-0 bg-linear-to-br from-[#0891B2]/10 via-transparent to-[#F59E0B]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

              <div className="absolute top-0 left-0 right-0 h-[1px] bg-linear-to-r from-transparent via-[#0891B2] to-transparent" />

              <div className="mb-6 flex items-center gap-4">
                <div className="relative flex justify-center items-center size-14 rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-linear-to-br from-[#0891B2] to-[#F59E0B] rounded-3xl blur-xl opacity-30 group-hover:opacity-60 transition-all duration-500" />
                  <p>image</p>
                </div>
                <div>
                  <p className="font-semibold text-xl text-white tracking-tight">
                    {item.name}
                  </p>
                  <p className="text-sm text-slate-400">{item.category}</p>
                </div>
              </div>

              <motion.div
                animate={{ scale: activeIndex === index ? [1, 1.06, 1] : 1 }}
                transition={{ duration: 2.2, repeat: Infinity }}
                className="mb-5"
              >
                <p className="text-6xl font-bold tracking-[-2px] bg-linear-to-br from-white to-slate-300 bg-clip-text text-transparent">
                  {item.after}
                </p>
                <p className="text-xs uppercase tracking-[2px] text-emerald-400 font-mono mt-1">
                  AFTER 90 DAYS
                </p>
              </motion.div>

              <div className="flex-1 mb-8">
                <p className="text-slate-300 leading-relaxed text-[15.2px]">
                  “{item.quote}”
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0">
                    📈
                  </div>
                  <div>
                    <p className="text-emerald-400 text-xs font-mono">GROWTH</p>
                    <p className="text-white">{item.after}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0">
                    👥
                  </div>
                  <div>
                    <p className="text-emerald-400 text-xs font-mono">
                      AUDIENCE
                    </p>
                    <p className="text-white">
                      {isRTL
                        ? `${item.after} ← ${item.before}`
                        : `${item.before} → ${item.after}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-auto">
                <div className="flex justify-between text-[10px] font-mono tracking-widest text-slate-500 mb-2">
                  <span>BEFORE</span>
                  <span>NOW</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: "38%" }}
                    whileInView={{ width: "94%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 2, delay: 0.4 + index * 0.15 }}
                    className="h-full bg-linear-to-r from-[#0891B2] via-[#22D3EE] to-[#F59E0B] rounded-full relative"
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_12px_#22D3EE] -mr-1.5" />
                  </motion.div>
                </div>
              </div>

              <div
                className={cn(
                  "absolute bottom-6 right-6 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1 rounded-2xl border border-emerald-500/30 text-[10px] font-mono text-emerald-400 z-20",
                  isRTL && "left-6 right-auto",
                )}
              >
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                <span>VERIFIED</span>
              </div>
            </motion.div>
          ))}
        </div>

        <SectionReveal delay={0.5}>
          <div className="mt-24 border-t border-white/10 pt-12">
            <p className="text-center text-slate-500 font-mono text-sm tracking-widest mb-10">
              TRUSTED BY CREATORS ON
            </p>

            <div className="flex flex-wrap justify-center gap-x-10 gap-y-10">
              {[
                {
                  name: "TikTok",
                  icon: faTiktok,
                  hoverBg: "hover:bg-[#69C9D0]/10",
                  hoverTextClass: "group-hover:text-[#69C9D0]",
                },
                {
                  name: "Instagram",
                  icon: faInstagram,
                  hoverBg: "hover:bg-[#E1306C]/10",
                  hoverTextClass: "group-hover:text-[#E1306C]",
                },
                {
                  name: "YouTube",
                  icon: faYoutube,
                  hoverBg: "hover:bg-[#FF0000]/10",
                  hoverTextClass: "group-hover:text-[#FF0000]",
                },
                {
                  name: "Facebook",
                  icon: faFacebook,
                  hoverBg: "hover:bg-[#1877F2]/10",
                  hoverTextClass: "group-hover:text-[#1877F2]",
                },
              ].map((platform, i) => (
                <motion.div
                  key={i}
                  whileHover={{
                    y: -8,
                    scale: 1.12,
                    transition: { duration: 0.4, ease: "easeOut" },
                  }}
                  whileTap={{ scale: 0.95 }}
                  className="group flex flex-col items-center gap-4 cursor-pointer"
                >
                  <div
                    className={`
            relative size-16 max-sm:size-11 flex items-center justify-center 
            bg-white/5 hover:bg-zinc-900 border border-white/10 
            rounded-3xl transition-all duration-500 overflow-hidden
            ${platform.hoverBg}
          `}
                  >
                    <div className="absolute inset-0 rounded-3xl border border-transparent group-hover:border-white/30 transition-all duration-500" />

                    <motion.div
                      whileHover={{ scale: 1.15, rotate: 8 }}
                      transition={{ duration: 0.6 }}
                    >
                      <FontAwesomeIcon
                        icon={platform.icon}
                        className={`h-9 w-9 text-white transition-colors duration-300 ${platform.hoverTextClass}`}
                      />
                    </motion.div>

                    <div className="absolute inset-0 bg-linear-to-br from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  </div>

                  <p className="text-sm font-medium text-slate-400 group-hover:text-white transition-colors tracking-wide">
                    {platform.name}
                  </p>
                </motion.div>
              ))}
            </div>

            <p className="text-center text-[13px] text-slate-500 mt-12 font-light">
              And thousands more creators growing every week
            </p>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
