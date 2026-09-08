"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, FileCheck2, Files, MessageCircle, Plus, ShieldCheck, Sparkles, TrendingUp, UserCheck, Users, type LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Tone = "gold" | "cyan" | "emerald" | "violet";
type IconName = "plus" | "message" | "report" | "sparkles" | "users" | "active" | "files" | "review";
const ICONS: Record<IconName, LucideIcon> = { plus: Plus, message: MessageCircle, report: FileCheck2, sparkles: Sparkles, users: Users, active: UserCheck, files: Files, review: ShieldCheck };
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

export function DashboardQuickAction({ href, title, hint, icon, tone }: { href: string; title: string; hint?: string; icon: IconName; tone: Tone }) {
  const [hovered, setHovered] = useState(false);
  const reduceMotion = useReducedMotion();
  const visual = TONES[tone];
  const Icon = ICONS[icon];
  return <motion.div whileHover={reduceMotion ? undefined : { y: -2 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}><Link href={href} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)} className="group relative flex min-h-[76px] items-center gap-3 overflow-hidden rounded-[18px] bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_24px_rgba(0,0,0,0.12)]"><Reveal visible={hovered} tone={tone} /><motion.span className="relative flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-[#111827]" animate={{ scale: hovered && !reduceMotion ? 1.05 : 1 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} style={{ color: visual.color, boxShadow: `inset 0 0 0 1px ${visual.color}25` }}><Icon className="size-4" /></motion.span><span className="relative min-w-0"><span className="block text-sm font-semibold text-white">{title}</span>{hint ? <span className="mt-0.5 block text-xs text-slate-500 transition-colors group-hover:text-slate-400">{hint}</span> : null}</span><ArrowUpRight className="relative ms-auto size-4 shrink-0 text-slate-600 transition-colors group-hover:text-white" /></Link></motion.div>;
}

export function ClientGrowthChart({ points, total, title }: { points: Array<{ label: string; value: number }>; total: number; title: string }) {
  const firstValue = points[0]?.value ?? 0;
  const newClients = Math.max(0, total - firstValue);
  return <article className="relative z-10 min-w-[250px] flex-1 overflow-hidden rounded-[18px] border border-[#6ee7b7]/15 bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_24px_rgba(0,0,0,0.12)] sm:max-w-[360px]"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">{title}</p><p className="mt-1 font-satoshi text-2xl leading-none text-white tabular-nums">{total}</p></div><span className="flex size-9 items-center justify-center rounded-[12px] bg-[#111827] text-[#6ee7b7] shadow-[inset_0_0_0_1px_rgba(110,231,183,0.2)]"><TrendingUp className="size-4" aria-hidden /></span></div><div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[#6ee7b7]"><TrendingUp className="size-3" aria-hidden />+{newClients} {newClients === 1 ? "new client" : "new clients"}</div><div className="mt-2 h-[76px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{ top: 8, right: 2, bottom: 0, left: -24 }}><defs><linearGradient id="clientGrowthArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6ee7b7" stopOpacity={0.35} /><stop offset="100%" stopColor="#6ee7b7" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="label" hide /><YAxis hide domain={[0, "dataMax + 1"]} /><Tooltip contentStyle={{ background: "#11120f", border: "1px solid rgba(110,231,183,.2)", borderRadius: 10, fontSize: 11 }} cursor={false} /><Area type="monotone" dataKey="value" stroke="#6ee7b7" strokeWidth={2.5} fill="url(#clientGrowthArea)" dot={false} isAnimationActive /></AreaChart></ResponsiveContainer></div></article>;
}

export function DashboardStatBox({ label, value, icon, tone }: { label: string; value: number; icon: IconName; tone: Tone }) {
  const [hovered, setHovered] = useState(false);
  const reduceMotion = useReducedMotion();
  const visual = TONES[tone];
  const Icon = ICONS[icon];
  return <motion.article onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} whileHover={reduceMotion ? undefined : { y: -2 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="relative min-h-[112px] overflow-hidden rounded-[18px] bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_28px_rgba(0,0,0,0.14)]"><Reveal visible={hovered} tone={tone} /><div className="relative flex items-center justify-between gap-4"><div><p className="text-xs tracking-wide text-slate-500 uppercase">{label}</p><p className="mt-2 font-satoshi text-3xl leading-none text-white tabular-nums">{value}</p></div><motion.span className="flex size-11 items-center justify-center rounded-[14px] bg-[#111827]" animate={{ scale: hovered && !reduceMotion ? 1.06 : 1 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }} style={{ color: visual.color, boxShadow: `inset 0 0 0 1px ${visual.color}25` }}><Icon className="size-5" /></motion.span></div></motion.article>;
}
