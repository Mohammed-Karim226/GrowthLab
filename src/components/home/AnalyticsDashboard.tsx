"use client";

import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
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
      <div
        className="rounded-3xl border border-[#0891B2]/30 bg-[#0D1235]/80 backdrop-blur-xl p-5 shadow-2xl"
        style={{
          boxShadow:
            "0 0 60px rgba(8,145,178,0.15), 0 0 120px rgba(59,130,246,0.08)",
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">
              {t("title")}
            </p>
            <p className="text-sm font-semibold text-white">@YourChannel</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-[#0891B2]/20 border border-[#0891B2]/40 px-3 py-1 text-xs font-medium text-[#0891B2]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0891B2] animate-pulse" />
            {t("live")}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 mb-4">
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
              className="rounded-2xl bg-[#0A0E27]/80 border border-white/5 p-3"
            >
              <p className="text-[10px] text-slate-500">{stat.label}</p>
              <p className="mt-2 text-base font-semibold text-white">
                {stat.value}
              </p>
              <p
                className="mt-1 text-xs font-medium"
                style={{ color: stat.color }}
              >
                {stat.change}
              </p>
            </div>
          ))}
        </div>

        <div className="mb-3">
          <p className="mb-2 text-[10px] text-slate-500">{t("subscriberGrowth")}</p>
          <div className="flex h-16 items-end gap-1.5">
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

        <div className="flex items-center justify-between border-t border-white/5 pt-3">
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
        className="absolute -bottom-3 -left-4 rounded-full bg-[#0D1235] border border-[#0891B2]/40 px-3 py-1.5 text-xs text-white shadow-lg"
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
        className="absolute -top-4 -right-4 rounded-full bg-[#F59E0B] px-3 py-1.5 text-xs font-bold text-black shadow-lg"
      >
       {t("subsMonth")}
      </motion.div>
    </motion.div>
  );
}
