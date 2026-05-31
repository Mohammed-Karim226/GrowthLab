"use client";
import AnimatedCounter from "@/components/home/AnimatedCounter";
import type { StatCard } from "@/lib/landing";
import { motion } from "framer-motion";

type StatsBarProps = {
  stats: StatCard[];
};

export default function StatsBar({ stats }: StatsBarProps) {
  return (
    <section className="py-10 border-y border-white/5 bg-[#08102a]">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="grid gap-8 text-center sm:grid-cols-3 cursor-pointer">
          {stats.map((stat) => (
              <div
                key={stat.label}
                className="relative group rounded-3xl border border-white/6 bg-[#0A0E27]/80 p-6 transition-transform duration-200 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.01] hover:border-white/10"
              >
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-3xl pointer-events-none transition-opacity duration-200 opacity-0 group-hover:opacity-60"
                  style={{
                    background: `radial-gradient(circle at 20% 20%, ${stat.color}40, transparent 50%)`,
                    filter: "blur(10px)",
                  }}
                />
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${stat.color}20`, color: stat.color }}>
                {stat.icon}
              </div>
              <p className="text-4xl font-semibold text-white">
                <AnimatedCounter target={stat.target} suffix={stat.suffix} />
              </p>
              <p className="mt-3 text-sm text-slate-400">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
