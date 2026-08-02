"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import Image from "next/image";

type NavBarProps = {
  brand: string;
  navLinks: {
    key: string;
    label: string;
    href: string;
  }[];
  signInLabel: string;
  bookCallLabel: string;
  scrolled: boolean;
  activeSection?: string;
  scrollProgress?: number;
};

export default function NavBar({
  brand,
  navLinks,
  signInLabel,
  bookCallLabel,
  scrolled,
  activeSection,
  scrollProgress = 0,
}: NavBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname() || "/";

  const alternateLocale = locale === "ar" ? "en" : "ar";
  const localeSwitchLabel = locale === "ar" ? t("switchToEn") : t("switchToAr");
  const localeSwitchHref =
    pathname.startsWith("/en") || pathname.startsWith("/ar")
      ? pathname.replace(/^\/(en|ar)(?=\/|$)/, `/${alternateLocale}`)
      : `/${alternateLocale}${pathname}`;

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "border-b border-white/[0.07] bg-[#070b1e]/80 shadow-2xl shadow-black/20 backdrop-blur-2xl" : "bg-transparent"
      }`}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px origin-left bg-linear-to-r from-cyan-300 via-blue-500 to-violet-500 transition-transform duration-150"
        style={{ transform: `scaleX(${scrollProgress})` }}
      />
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white shadow-lg shadow-cyan-950/30">
            {/* <Youtube className="h-5 w-5" /> */}
            <Image src = "/images/strategy.png" alt="logo" width={40} height={40} />
          </div>
          <span className="font-satoshi text-lg tracking-tight text-white">{brand}</span>
        </div>

        <div className="hidden items-center gap-1 xl:gap-2 md:flex">
          {navLinks.map((link) => {
            const isActive = activeSection === link.href.replace("#", "");
            return (
              <a
                key={link.key}
                href={link.href}
                aria-current={isActive ? "true" : undefined}
                className={`relative rounded-full px-3 py-2 text-sm transition-colors xl:text-[15px] ${
                  isActive
                    ? "text-white"
                    : "text-slate-400 hover:text-cyan-100"
                }`}
              >
                {isActive && (
                  <span className="absolute inset-0 rounded-full border border-cyan-300/25 bg-cyan-300/[0.08]" />
                )}
                <span className="relative">{link.label}</span>
              </a>
            );
          })}
        </div>

        <div className="hidden lg:flex items-center gap-2 xl:gap-3">
          <Link
            href={localeSwitchHref}
            className="rounded-full border border-white/10 bg-white/[0.025] px-3 py-2 text-sm font-medium text-white transition hover:border-cyan-300/40 xl:px-4"
          >
            {localeSwitchLabel}
          </Link>
          <a
            href="#contact"
            className="rounded-full px-3 py-2 text-sm font-medium text-slate-300 transition hover:text-white xl:px-4"
          >
            {signInLabel}
          </a>
          <a
            href="#contact"
            className="button-primary rounded-full px-4 py-2.5 text-sm font-semibold text-white xl:px-5"
          >
            {bookCallLabel}
          </a>
        </div>

        <button
          type="button"
          className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] p-2 text-white transition hover:bg-white/[0.09] md:hidden"
          onClick={() => setMobileMenuOpen((current) => !current)}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-white/10 bg-[#0A0E27]/95 backdrop-blur-xl md:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-1.5 px-4 py-4 sm:px-6">
              {navLinks.map((link) => {
                const isActive = activeSection === link.href.replace("#", "");
                return (
                  <a
                    key={link.key}
                    href={link.href}
                    aria-current={isActive ? "true" : undefined}
                    className={`rounded-2xl px-4 py-3 text-sm transition ${
                      isActive
                        ? "border border-cyan-300/25 bg-cyan-300/[0.08] text-white"
                        : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                );
              })}

              <div className="mt-3 grid gap-2.5 border-t border-white/10 pt-4">
                <Link
                  href={localeSwitchHref}
                  className="rounded-full border border-white/10 px-5 py-3 text-center text-sm font-medium text-white transition hover:border-cyan-300/40 hover:bg-white/[0.04]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {localeSwitchLabel}
                </Link>
                <a
                  href="#contact"
                  className="button-primary button-shine rounded-full px-5 py-3 text-center text-sm font-semibold text-white"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {bookCallLabel}
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
