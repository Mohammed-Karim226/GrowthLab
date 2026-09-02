"use client";

import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Clock,
  Instagram,
  Mail,
  MessageCircle,
  Music,
  Shield,
  TrendingUp,
  Users,
  Youtube,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";

const contactActions = [
  {
    key: "whatsapp",
    href: "https://wa.me/201126421602",
    icon: MessageCircle,
    accent: "text-emerald-300",
    iconBackground: "bg-emerald-400/15",
    border: "hover:border-emerald-400/60",
    glow: "hover:shadow-[0_18px_50px_rgba(52,211,153,0.16)]",
  },
  {
    key: "gmail",
    href: "https://mail.google.com/mail/?view=cm&fs=1&to=growthlabagency2090@gmail.com",
    icon: Mail,
    accent: "text-cyan-300",
    iconBackground: "bg-cyan-400/15",
    border: "hover:border-cyan-400/60",
    glow: "hover:shadow-[0_18px_50px_rgba(34,211,238,0.16)]",
  },
] as const;

export default function ContactSection() {
  const t = useTranslations("contact");

  return (
    <section id="contact" className="relative overflow-hidden bg-[#030614] pt-2 pb-10">
      <div className="dot-overlay-lg pointer-events-none absolute inset-0 opacity-40" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="space-y-12"
          >
            <div className="max-sm:flex max-sm:flex-col max-sm:items-center max-sm:justify-center">
              <div className="mb-8 inline-flex items-center gap-3 rounded-3xl border border-cyan-400/30 bg-linear-to-r from-cyan-500/10 to-violet-500/10 px-6 py-3">
                <Zap className="h-6 w-6 animate-pulse text-cyan-400" />
                <span className="text-sm font-mono font-semibold tracking-[3px] text-cyan-300">
                  {t("badge")}
                </span>
              </div>

              <h2 className="text-5xl leading-12 font-bold tracking-tighter max-sm:text-center max-sm:text-4xl max-sm:leading-16">
                {t("titleLine1")} {" "}
                <span className="animate-gradient bg-linear-to-r from-[#67E8F9] via-[#C084FC] to-[#F472B6] bg-clip-text text-transparent">
                  {t("titleHighlight")}
                </span>
              </h2>
            </div>

            <div className="space-y-8">
              {[TrendingUp, Users, Clock, Shield].map((Icon, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="group flex gap-6"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-400/10 to-violet-400/10 transition-transform group-hover:rotate-12">
                    <Icon className="h-7 w-7 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-white">{t(`features.${i}.title`)}</p>
                    <p className="mt-1.5 text-slate-400">{t(`features.${i}.desc`)}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex items-center gap-4 border-t border-white/10 pt-8">
              <div className="flex -space-x-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-10 w-10 overflow-hidden rounded-full border-2 border-[#030614] ring-2 ring-cyan-400/30"
                  >
                    <img src={`https://randomuser.me/api/portraits/men/${i + 15}.jpg`} alt="" />
                  </div>
                ))}
              </div>
              <div className="relative text-sm leading-tight text-slate-400">
                <p>{t("trustedBy")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white shadow-[0_0_15px_rgba(248,113,113,0.18)]">
                    <Youtube className="h-4 w-4 text-red-400" /> YouTube
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white shadow-[0_0_15px_rgba(148,163,184,0.2)]">
                    <Music className="h-4 w-4 text-slate-200" /> TikTok
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white shadow-[0_0_15px_rgba(244,114,182,0.2)]">
                    <Instagram className="h-4 w-4 text-pink-300" /> Instagram
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2 }}
          >
            <div className="relative rounded-3xl border border-white/10 bg-[#0A0E27] p-6 shadow-2xl backdrop-blur-3xl sm:p-10 lg:p-12">
              <div className="absolute -inset-px -z-10 rounded-3xl bg-linear-to-br from-cyan-400/20 via-violet-400/10 to-transparent" />

              <div className="mb-9 max-w-lg">
                <h3 className="text-3xl font-bold text-white max-sm:text-2xl">{t("contactTitle")}</h3>
                <p className="mt-3 text-base leading-7 text-slate-400">{t("contactDescription")}</p>
              </div>

              <div className="grid gap-4">
                {contactActions.map((action) => {
                  const Icon = action.icon;

                  return (
                    <motion.a
                      key={action.key}
                      href={action.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.99 }}
                      className={`group flex min-h-24 items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-all sm:p-5 ${action.border} ${action.glow}`}
                    >
                      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${action.iconBackground}`}>
                        <Icon className={`h-7 w-7 ${action.accent}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-semibold text-white">{t(`actions.${action.key}.label`)}</span>
                        <span className="mt-1 block text-sm leading-5 text-slate-400">{t(`actions.${action.key}.description`)}</span>
                      </span>
                      <ArrowUpRight className={`h-5 w-5 shrink-0 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1 ${action.accent}`} />
                    </motion.a>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
