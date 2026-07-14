"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, BarChart3, MoreHorizontal, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

const bars = [45, 62, 38, 78, 55, 91, 67, 83, 74, 95];

export default function AnalyticsDashboard() {
  const t = useTranslations("analytics");
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1, y: [0, -12, 0] }}
      transition={{
        y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
        opacity: { duration: 1.5 },
        scale: { duration: 1.5 },
      }}
      className="relative w-full max-w-lg mx-auto"
    >
      <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-cyan-400/20 via-transparent to-violet-500/15 blur-2xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b1129]/85 p-4 shadow-[0_32px_100px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-5">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent" />
        <div className="mb-5 flex items-center justify-between border-b border-white/[0.07] pb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t("title")}
            </p>
            <p className="mt-1 text-sm font-semibold text-white">@YourChannel</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1.5 text-[10px] font-semibold text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0891B2] animate-pulse" />
            {t("live")}
            </div>
            <MoreHorizontal className="h-5 w-5 text-slate-500" />
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3 mb-5">
          {[
            {
              label: t("subscribers"),
              value: "124.8K",
              change: "+18.3%",
              color: "#0891B2",
            },
            {
              label: t("views"),
              value: "2.4M",
              change: "+31.2%",
              color: "#3B82F6",
            },
            {
              label: t("watchTime"),
              value: "68%",
              change: "+12.1%",
              color: "#F59E0B",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3.5"
            >
              <p className="text-[10px] font-medium text-slate-500">{stat.label}</p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-white">
                {stat.value}
              </p>
              <p className="mt-1 flex items-center gap-0.5 text-[11px] font-semibold"
                style={{ color: stat.color }}
              >
                <ArrowUpRight className="h-3 w-3" />{stat.change}
              </p>
            </div>
          ))}
        </div>

        <div className="mb-4 rounded-2xl border border-white/[0.07] bg-[#070c20]/70 p-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] font-medium text-slate-500">{t("subscriberGrowth")}</p>
            <BarChart3 className="h-4 w-4 text-cyan-300" />
          </div>
          <div className="flex h-20 items-end gap-1.5">
            {bars.map((value, index) => (
              <motion.div
                key={index}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{
                  delay: index * 0.08,
                  duration: 0.5,
                  ease: "easeOut",
                }}
                className="flex-1 rounded-t-sm"
                style={{
                  originY: 1,
                  height: `${value}%`,
                  background:
                    index === bars.length - 1
                      ? "linear-gradient(to top, #0891B2, #3B82F6)"
                      : `rgba(8,145,178,${0.3 + index / bars.length / 1.5})`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
            <span className="text-xs">
               {t("avgCtr", { value: "80.4%" })}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-[#0891B2]">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>{t("vsLast90d")}</span>
          </div>
        </div>
      </div>

      <motion.div
        animate={{ opacity: 1, scale: 1, x: [0, 12, 0] }}
        transition={{
          delay: 0.9,
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -bottom-4 -left-3 rounded-full border border-cyan-300/25 bg-[#111936]/95 px-3 py-2 text-[11px] text-white shadow-xl backdrop-blur-xl sm:-left-6"
      >
        {t("algorithmBoost")}
      </motion.div>

      <motion.div
        animate={{ opacity: 1, scale: 1, x: [0, -12, 0] }}
        transition={{
          delay: 0.9,
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -right-2 -top-4 rounded-full border border-amber-200/20 bg-amber-300 px-3 py-2 text-[11px] font-bold text-slate-950 shadow-xl sm:-right-5"
      >
       {t("subsMonth")}
      </motion.div>
    </motion.div>
  );
}
