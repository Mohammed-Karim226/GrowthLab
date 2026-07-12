"use client";

import SectionReveal from "@/components/home/SectionReveal";
import { motion, useReducedMotion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFacebook,
  faInstagram,
  faTiktok,
  faYoutube,
} from "@fortawesome/free-brands-svg-icons";
import type { Testimonial } from "@/lib/landing";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Quote, Radar, Sparkles, TrendingUp, Users } from "lucide-react";

type TestimonialsSectionProps = {
  testimonials: Testimonial[];
};

const orbitSlots = [
  "left-[4%] top-[18%]",
  "left-[17%] bottom-[10%]",
  "left-1/2 top-[4%] -translate-x-1/2",
  "right-[17%] bottom-[10%]",
  "right-[4%] top-[18%]",
  "left-1/2 bottom-[2%] -translate-x-1/2",
];

const platformItems = [
  {
    name: "TikTok",
    icon: faTiktok,
    color: "#69C9D0",
    glow: "shadow-[0_0_34px_rgba(105,201,208,0.16)]",
  },
  {
    name: "Instagram",
    icon: faInstagram,
    color: "#E1306C",
    glow: "shadow-[0_0_34px_rgba(225,48,108,0.18)]",
  },
  {
    name: "YouTube",
    icon: faYoutube,
    color: "#FF3B30",
    glow: "shadow-[0_0_34px_rgba(255,59,48,0.18)]",
  },
  {
    name: "Facebook",
    icon: faFacebook,
    color: "#1877F2",
    glow: "shadow-[0_0_34px_rgba(24,119,242,0.18)]",
  },
];

function compactNumber(value: string) {
  const numeric = Number(value.toLowerCase().replace("k", ""));
  if (Number.isNaN(numeric)) return value;
  return value.toLowerCase().includes("k") ? numeric * 1000 : numeric;
}

export default function TestimonialsSection({
  testimonials,
}: TestimonialsSectionProps) {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const t = useTranslations("testimonials");
  const prefersReducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);

  const stories = useMemo(() => testimonials.slice(0, 6), [testimonials]);
  const active = stories[activeIndex] ?? stories[0];

  useEffect(() => {
    if (stories.length <= 1 || prefersReducedMotion) return;
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % stories.length);
    }, 5200);
    return () => window.clearInterval(interval);
  }, [prefersReducedMotion, stories.length]);

  if (!active) return null;

  const before = compactNumber(active.before);
  const after = compactNumber(active.after);
  const lift =
    typeof before === "number" && typeof after === "number" && before > 0
      ? Math.round(((after - before) / before) * 100)
      : null;

  return (
    <section
      id="testimonials"
      className="relative overflow-hidden py-24 sm:py-28 lg:py-36"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(8,145,178,0.2),transparent_36%),radial-gradient(circle_at_18%_72%,rgba(245,158,11,0.15),transparent_28%),linear-gradient(180deg,rgba(5,7,15,0.15),rgba(3,6,20,0.78))]" />
        <div className="absolute left-1/2 top-20 h-[48rem] w-[48rem] -translate-x-1/2 rounded-full border border-cyan-300/10" />
        <div className="absolute left-1/2 top-28 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full border border-white/5" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionReveal>
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <div className="liquid-glass mx-auto mb-6 inline-flex items-center gap-3 rounded-full px-5 py-2">
              <Radar className="h-4 w-4 text-cyan-300" />
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
                {t("badge")}
              </span>
            </div>

            <h2 className="font-satoshi text-4xl font-bold leading-tight text-white sm:text-6xl lg:text-7xl">
              {t("titleLine1")}{" "}
              <span className="bg-linear-to-r from-[#F59E0B] via-[#22D3EE] to-[#A855F7] bg-clip-text text-transparent">
                {t("titleLine2Prefix")}
                {t("titleLine2Highlight")}
                {t("titleLine2Suffix")}
              </span>
            </h2>

            <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-slate-400 sm:text-lg">
              {t("description")}
            </p>
          </div>
        </SectionReveal>

        <div className="relative min-h-[720px] lg:min-h-[780px]">
          <motion.div
            aria-hidden
            className="absolute left-1/2 top-1/2 hidden h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full lg:block"
            animate={prefersReducedMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 54, repeat: Infinity, ease: "linear" }}
          >
            <div className="absolute inset-0 rounded-full border border-dashed border-cyan-300/18" />
            <div className="absolute inset-16 rounded-full border border-white/10" />
            <div className="absolute inset-32 rounded-full border border-amber-300/10" />
          </motion.div>

          <div className="absolute inset-0 hidden lg:block">
            {stories.map((item, index) => {
              const isActive = index === activeIndex;
              return (
                <motion.button
                  type="button"
                  key={item.name}
                  onClick={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  className={cn(
                    "liquid-glass group absolute w-[214px] rounded-[28px] p-3 text-left outline-none transition-all focus-visible:ring-4 focus-visible:ring-cyan-400/30",
                    orbitSlots[index % orbitSlots.length],
                    isActive
                      ? "border-cyan-300/60 shadow-[0_24px_80px_rgba(34,211,238,0.2)]"
                      : "opacity-70 hover:opacity-100",
                    isRTL && "text-right"
                  )}
                  animate={
                    prefersReducedMotion
                      ? undefined
                      : { y: isActive ? [-3, -12, -3] : [0, -7, 0] }
                  }
                  transition={{
                    duration: 4 + index * 0.35,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/20">
                      <Image
                        src={item.avatar}
                        alt={t(`items.${index}.name`)}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {t(`items.${index}.name`)}
                      </p>
                      <p className="truncate text-xs text-cyan-200/70">
                        {t(`items.${index}.category`)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/[0.055] px-3 py-2">
                    <span className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      {t("now")}
                    </span>
                    <span className="text-sm font-bold text-emerald-300">
                      {item.after}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <SectionReveal delay={0.12}>
            <motion.article
              key={activeIndex}
              initial={{ opacity: 0, scale: 0.96, y: 28 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="liquid-card relative z-10 mx-auto grid max-w-5xl overflow-hidden rounded-[40px] lg:grid-cols-[0.9fr_1.1fr]"
            >
              <div className="relative min-h-[420px] overflow-hidden p-6 sm:p-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_16%,rgba(245,158,11,0.22),transparent_30%),radial-gradient(circle_at_78%_80%,rgba(34,211,238,0.24),transparent_36%)]" />
                <motion.div
                  aria-hidden
                  className="absolute -left-24 top-12 h-72 w-72 rounded-full border border-cyan-300/20"
                  animate={prefersReducedMotion ? undefined : { rotate: -360 }}
                  transition={{ duration: 38, repeat: Infinity, ease: "linear" }}
                />

                <div className="relative flex h-full flex-col justify-between">
                  <div className="flex items-center justify-between gap-3">
                    <div className="liquid-glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
                      {t("verified")}
                    </div>
                    <Sparkles className="h-5 w-5 text-amber-300" />
                  </div>

                  <div className="mx-auto my-10 grid place-items-center">
                    <div className="relative h-52 w-52 sm:h-64 sm:w-64">
                      <div className="absolute inset-0 rounded-[42px] bg-linear-to-br from-cyan-300/30 via-white/10 to-amber-300/30 blur-2xl" />
                      <div className="absolute inset-4 rotate-6 rounded-[38px] border border-white/15 bg-white/5" />
                      <div className="relative h-full w-full overflow-hidden rounded-[42px] border border-white/20 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
                        <Image
                          src={active.avatar}
                          alt={t(`items.${activeIndex}.name`)}
                          fill
                          className="object-cover"
                          sizes="(min-width: 640px) 256px, 208px"
                          priority={activeIndex === 0}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <MetricPill label={t("before")} value={active.before} />
                    <MetricPill label={t("now")} value={active.after} active />
                  </div>
                </div>
              </div>

              <div className="relative flex min-h-[420px] flex-col justify-between p-6 sm:p-8 lg:p-10">
                <Quote className="h-10 w-10 text-cyan-300/70" />

                <div>
                  <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
                    {t(`items.${activeIndex}.category`)}
                  </p>
                  <h3 className="text-3xl font-semibold text-white sm:text-5xl">
                    {t(`items.${activeIndex}.name`)}
                  </h3>
                  <p className="mt-8 text-xl leading-9 text-slate-100 sm:text-2xl sm:leading-10">
                    "{t(`items.${activeIndex}.quote`)}"
                  </p>
                </div>

                <div className="mt-10 grid gap-4 sm:grid-cols-3">
                  <SignalCard
                    icon={<TrendingUp className="h-5 w-5" />}
                    label={t("growth")}
                    value={lift !== null ? `+${lift}%` : active.after}
                    tone="cyan"
                  />
                  <SignalCard
                    icon={<Users className="h-5 w-5" />}
                    label={t("audience")}
                    value={
                      isRTL
                        ? `${active.after} <- ${active.before}`
                        : `${active.before} -> ${active.after}`
                    }
                    tone="gold"
                  />
                  <SignalCard
                    icon={<Radar className="h-5 w-5" />}
                    label={t("afterLabel")}
                    value={active.after}
                    tone="violet"
                  />
                </div>
              </div>
            </motion.article>
          </SectionReveal>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:hidden">
          {stories.map((item, index) => (
            <button
              type="button"
              key={`mobile-${item.name}`}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "liquid-glass flex min-h-20 items-center gap-3 rounded-[24px] p-3 text-left",
                index === activeIndex && "border-cyan-300/60",
                isRTL && "text-right"
              )}
            >
              <Image
                src={item.avatar}
                alt={t(`items.${index}.name`)}
                width={48}
                height={48}
                className="h-12 w-12 rounded-2xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {t(`items.${index}.name`)}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {`${item.before} -> ${item.after}`}
                </p>
              </div>
            </button>
          ))}
        </div>

        <SectionReveal delay={0.24}>
          <div className="mt-20">
            <p className="mb-8 text-center text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
              {t("trustedByCreatorsOn")}
            </p>
            <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-4">
              {platformItems.map((platform) => (
                <motion.div
                  key={platform.name}
                  whileHover={
                    prefersReducedMotion ? undefined : { y: -8, scale: 1.05 }
                  }
                  className={cn(
                    "liquid-glass group flex min-h-16 items-center gap-3 rounded-full px-5",
                    platform.glow
                  )}
                >
                  <FontAwesomeIcon
                    icon={platform.icon}
                    className="h-6 w-6 transition-transform group-hover:scale-110"
                    style={{ color: platform.color }}
                  />
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white">
                    {platform.name}
                  </span>
                </motion.div>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-slate-500">
              {t("thousandsMore")}
            </p>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}

function MetricPill({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "liquid-glass rounded-[22px] p-4",
        active && "border-emerald-300/35"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-bold",
          active ? "text-emerald-300" : "text-white"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SignalCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "cyan" | "gold" | "violet";
}) {
  const toneClass = {
    cyan: "text-cyan-300 border-cyan-300/20",
    gold: "text-amber-300 border-amber-300/20",
    violet: "text-violet-300 border-violet-300/20",
  }[tone];

  return (
    <div className={cn("liquid-glass rounded-[24px] p-4", toneClass)}>
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/8">
        {icon}
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
