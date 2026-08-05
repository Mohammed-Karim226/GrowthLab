"use client";

import AnimatedCounter from "@/components/home/AnimatedCounter";
import type { StatCard } from "@/lib/landing";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

type StatsBarProps = {
  stats: StatCard[];
};

export default function StatsBar({ stats }: StatsBarProps) {
  const t = useTranslations("stats");

  return (
    <section className="py-10 border-y border-white/5 bg-[#08102a]">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="grid gap-8 text-center sm:grid-cols-3"
        >
          {stats.map((stat, index) => (
            <div
              key={index}
              className="group relative overflow-hidden rounded-3xl border border-white/[0.06] bg-[#0A0E27]/80 p-6 transition-all duration-300 ease-out hover:border-white/15 motion-safe:hover:-translate-y-1"
            >
              <div
                aria-hidden
                className="absolute inset-0 rounded-3xl pointer-events-none transition-opacity duration-200 opacity-0 group-hover:opacity-60"
                style={{
                  background: `radial-gradient(circle at 20% 20%, ${stat.color}40, transparent 50%)`,
                  filter: "blur(10px)",
                }}
              />
              <div
                className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
                style={{ background: `${stat.color}20`, color: stat.color }}
              >
                {stat.icon}
              </div>
              <p className="text-4xl font-semibold tracking-tight text-white">
                <AnimatedCounter target={stat.target} suffix={stat.suffix} />
              </p>
              <p className="mt-3 text-sm text-slate-400">
                {t(`items.${index}.label`)}
              </p>
              <div
                aria-hidden
                className="absolute inset-x-6 bottom-0 h-px origin-center scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
                style={{
                  background: `linear-gradient(90deg, transparent, ${stat.color}, transparent)`,
                }}
              />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
