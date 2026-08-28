"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, FileCheck2, Files, MessageCircle, Plus, ShieldCheck, UserCheck, Users, type LucideIcon } from "lucide-react";

type Tone = "gold" | "cyan" | "emerald" | "violet";
type IconName = "plus" | "message" | "report" | "users" | "active" | "files" | "review";
const ICONS: Record<IconName, LucideIcon> = { plus: Plus, message: MessageCircle, report: FileCheck2, users: Users, active: UserCheck, files: Files, review: ShieldCheck };
const TONES: Record<Tone, { color: string; soft: string }> = {
  gold: { color: "#ead178", soft: "rgba(234,209,120,0.15)" },
  cyan: { color: "#67e8f9", soft: "rgba(103,232,249,0.14)" },
  emerald: { color: "#6ee7b7", soft: "rgba(110,231,183,0.14)" },
  violet: { color: "#c4b5fd", soft: "rgba(196,181,253,0.15)" },
};

function Reveal({ visible, tone }: { visible: boolean; tone: Tone }) {
  const reduceMotion = useReducedMotion();
  const visual = TONES[tone];
  return <motion.span aria-hidden className="pointer-events-none absolute inset-0" initial={false} animate={visible ? { opacity: 1, clipPath: "circle(145% at 18% 35%)" } : { opacity: 0, clipPath: "circle(18% at 18% 35%)" }} transition={{ duration: reduceMotion ? 0 : 0.58, ease: [0.16, 1, 0.3, 1] }} style={{ background: `radial-gradient(circle at 18% 35%, ${visual.soft} 0%, ${visual.soft} 25%, rgba(255,255,255,0.016) 72%)` }} />;
}

export function DashboardQuickAction({ href, title, hint, icon, tone }: { href: string; title: string; hint: string; icon: IconName; tone: Tone }) {
  const [hovered, setHovered] = useState(false);
  const reduceMotion = useReducedMotion();
  const visual = TONES[tone];
  const Icon = ICONS[icon];
  return <motion.div whileHover={reduceMotion ? undefined : { y: -2 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}><Link href={href} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)} className="group relative flex min-h-[76px] items-center gap-3 overflow-hidden rounded-[18px] bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_24px_rgba(0,0,0,0.12)]"><Reveal visible={hovered} tone={tone} /><motion.span className="relative flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-[#111827]" animate={{ scale: hovered && !reduceMotion ? 1.05 : 1 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} style={{ color: visual.color, boxShadow: `inset 0 0 0 1px ${visual.color}25` }}><Icon className="size-4" /></motion.span><span className="relative min-w-0"><span className="block text-sm font-semibold text-white">{title}</span><span className="mt-0.5 block text-xs text-slate-500 transition-colors group-hover:text-slate-400">{hint}</span></span><ArrowUpRight className="relative ms-auto size-4 shrink-0 text-slate-600 transition-colors group-hover:text-white" /></Link></motion.div>;
}

export function DashboardStatBox({ label, value, icon, tone }: { label: string; value: number; icon: IconName; tone: Tone }) {
  const [hovered, setHovered] = useState(false);
  const reduceMotion = useReducedMotion();
  const visual = TONES[tone];
  const Icon = ICONS[icon];
  return <motion.article onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} whileHover={reduceMotion ? undefined : { y: -2 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="relative min-h-[112px] overflow-hidden rounded-[18px] bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_28px_rgba(0,0,0,0.14)]"><Reveal visible={hovered} tone={tone} /><div className="relative flex items-center justify-between gap-4"><div><p className="text-xs tracking-wide text-slate-500 uppercase">{label}</p><p className="mt-2 font-satoshi text-3xl leading-none text-white tabular-nums">{value}</p></div><motion.span className="flex size-11 items-center justify-center rounded-[14px] bg-[#111827]" animate={{ scale: hovered && !reduceMotion ? 1.06 : 1 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }} style={{ color: visual.color, boxShadow: `inset 0 0 0 1px ${visual.color}25` }}><Icon className="size-5" /></motion.span></div></motion.article>;
}
