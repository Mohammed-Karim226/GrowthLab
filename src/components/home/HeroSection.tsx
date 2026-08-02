"use client";

import { ArrowLeft, ArrowRight, ChevronDown, Play, Sparkles, Star } from "lucide-react";
import AnalyticsDashboard from "@/components/home/AnalyticsDashboard";
import Image from "next/image";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";

export default function HeroSection() {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const t = useTranslations("hero");

  return (
    <section className="hero-grid relative min-h-[calc(100vh-5rem)] overflow-hidden pt-16 pb-10 sm:pt-24 lg:pt-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[8%] top-16 h-[28rem] w-[28rem] rounded-full bg-cyan-400/15 blur-[110px]" />
        <div className="absolute right-[4%] top-24 h-[26rem] w-[26rem] rounded-full bg-blue-500/15 blur-[110px]" />
        <div className="absolute bottom-[-12rem] left-1/2 h-[26rem] w-[55rem] -translate-x-1/2 rounded-full bg-violet-500/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:px-8">
        <div className="relative z-10 flex flex-col justify-center gap-7">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.9 }}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200"
          >
            <Sparkles className="h-4 w-4" />
            {t("subtitle")}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="font-satoshi max-w-3xl text-5xl leading-[0.97] text-white sm:text-6xl lg:text-7xl xl:text-[5.35rem]"
          >
            {t("titleLine1")}
            <br />
            <span className="gradient-text-teal">{t("titleLine2")}</span>
            <br />
            {t("titleLine3")}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.9 }}
            className="max-w-xl text-base leading-8 text-slate-300/80 sm:text-lg"
          >
            {t("description")}
          </motion.p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <motion.a
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, duration: 0.9 }}
              href="#contact"
              className="button-primary button-shine inline-flex items-center justify-center gap-2 rounded-full px-7 py-4 text-sm font-semibold text-white"
            >
              {t("ctaBook")}
              {isRTL ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            </motion.a>
            <motion.a
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, duration: 0.9 }}
              href="#how-it-works"
              className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-7 py-4 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/[0.06]"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 transition group-hover:bg-cyan-400/25">
                <Play className="h-3 w-3 fill-current" />
              </span>
              {t("ctaHowItWorks")}
            </motion.a>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
            <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((index) => (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  key={index}
                  className="transition-transform hover:z-10 hover:-translate-y-1"
                >
                  <Image
                    src="/images/creator.png"
                    alt=""
                    aria-hidden
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-full border-2 border-[#070b1e] object-cover ring-1 ring-white/10"
                  />
                </motion.div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, idx) => (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 + 0.5 }}
                    key={idx}
                  >
                    <Star
                      className="h-3.5 w-3.5 text-[#F59E0B]"
                      fill="currentColor"
                      stroke="currentColor"
                    />
                  </motion.div>
                ))}
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="text-xs text-slate-400"
              >
                {t("trustedBy", { count: 1_000 })}
              </motion.p>
            </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 lg:pl-3">
          <AnalyticsDashboard />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: [0, -12, 0] }}
        transition={{
          opacity: { delay: 1.5, duration: 0.8 },
          y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
        }}
        className="absolute inset-x-0 bottom-3 hidden justify-center text-slate-600 lg:flex"
      >
        <ChevronDown className="h-6 w-6" />
      </motion.div>
    </section>
  );
}
