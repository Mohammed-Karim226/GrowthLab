"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  ChevronRight,
  FileBarChart,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { faFacebook, faInstagram, faTiktok, faYoutube } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { AccountRow, Platform } from "@/types/database";

import { cn } from "@/lib/utils";
import SignOutButton from "@/components/auth/SignOutButton";
import { Button } from "@/components/ui/button";

type PortalShellProps = {
  clientName: string;
  clientEmail: string | null;
  accounts: AccountRow[];
  children: React.ReactNode;
};

const PLATFORM_ICONS = { facebook: faFacebook, instagram: faInstagram, tiktok: faTiktok, youtube: faYoutube };
const PLATFORM_COLORS: Record<Platform, string> = { facebook: "#79a7ff", instagram: "#f19ac7", tiktok: "#8de6e5", youtube: "#ff8d8d" };

function accountHref(account: AccountRow) {
  const value = account.page_id?.trim() || account.page_name?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const handle = value.replace(/^@/, "");
  const paths: Record<Platform, string> = {
    facebook: `https://www.facebook.com/${encodeURIComponent(handle)}`,
    instagram: `https://www.instagram.com/${encodeURIComponent(handle)}`,
    tiktok: `https://www.tiktok.com/@${encodeURIComponent(handle)}`,
    youtube: `https://www.youtube.com/@${encodeURIComponent(handle)}`,
  };
  return paths[account.platform];
}

const NAV = [
  { key: "overview", href: "", icon: BarChart3 },
  { key: "reports", href: "/reports", icon: FileBarChart },
] as const;

export default function PortalShell({ clientName, clientEmail, accounts, children }: PortalShellProps) {
  const t = useTranslations("portal");
  const locale = useLocale();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const base = `/${locale}/portal`;
  const initial = clientName.trim().charAt(0).toUpperCase() || "G";

  function isActive(href: string) {
    const full = `${base}${href}`;
    return href === "" ? pathname === full || pathname === `${full}/` : pathname.startsWith(full);
  }

  const nav = (
    <nav className="space-y-2" aria-label={t("nav.label")}>
      <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.24em] text-[#77766f] uppercase">
        {t("nav.label")}
      </p>
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);

        return (
          <Link
            key={item.key}
            href={`${base}${item.href}`}
            onClick={() => setMenuOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3.5 py-3 text-sm font-medium transition-colors",
              active ? "text-[#f8f5ec]" : "text-[#8f8e88] hover:text-[#dedbd1]"
            )}
          >
            {active && (
              <span
                className="absolute inset-0 rounded-2xl border border-white/[0.08] bg-white/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              />
            )}
            <span
              className={cn(
                "relative flex size-9 shrink-0 items-center justify-center rounded-xl border transition-all",
                active
                  ? "border-[#d8be78]/25 bg-[#d8be78]/10 text-[#e5cd8c]"
                  : "border-white/[0.06] bg-white/[0.025] text-[#77766f] group-hover:border-white/10 group-hover:text-[#c9c5ba]"
              )}
            >
              <Icon className="size-[17px]" strokeWidth={1.8} aria-hidden />
            </span>
            <span className="relative flex-1">{t(`nav.${item.key}` as never)}</span>
            <ChevronRight
              className={cn(
                "relative size-3.5 transition-all rtl:rotate-180",
                active ? "text-[#d8be78]" : "-translate-x-1 text-transparent group-hover:translate-x-0 group-hover:text-[#77766f]"
              )}
              aria-hidden
            />
          </Link>
        );
      })}
    </nav>
  );

  const activeAccounts = accounts.filter((account) => account.stage?.toLowerCase() !== "inactive");
  const accountsNav = (
    <section className="mt-7 border-t border-white/[0.07] pt-6" aria-label={t("nav.accounts")}>
      <div className="mb-3 flex items-center justify-between px-3">
        <p className="text-[10px] font-semibold tracking-[0.24em] text-[#77766f] uppercase">{t("nav.accounts")}</p>
        <span className="rounded-full border border-[#54d8ac]/20 bg-[#54d8ac]/10 px-2 py-0.5 text-[9px] font-semibold text-[#78d9b9]">{activeAccounts.length}</span>
      </div>
      <div className="space-y-1.5">
        {activeAccounts.map((account) => {
          const href = accountHref(account);
          const Icon = PLATFORM_ICONS[account.platform];
          const label = account.page_name || account.page_id || t(`platforms.${account.platform}` as never);
          if (!href) return null;
          return <a key={account.id} href={href} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-[#aaa79d] transition-colors hover:bg-white/[0.05] hover:text-white">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.035]" style={{ color: PLATFORM_COLORS[account.platform] }}><FontAwesomeIcon icon={Icon} className="size-3.5" aria-hidden /></span>
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <span className="size-1.5 rounded-full bg-[#54d8ac] shadow-[0_0_8px_rgba(84,216,172,0.8)]" aria-label={t("nav.activeAccount")} />
          </a>;
        })}
        {activeAccounts.length === 0 && <p className="px-3 text-[11px] leading-relaxed text-[#77766f]">{t("nav.noAccounts")}</p>}
      </div>
    </section>
  );

  const identity = (
    <div className="rounded-[22px] border border-white/[0.07] bg-white/[0.035] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center gap-3">
        <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ead69e] to-[#a8863f] text-sm font-bold text-[#17150f] shadow-[0_8px_24px_rgba(216,190,120,0.14)]">
          {initial}
          <span className="absolute -end-0.5 -bottom-0.5 size-3 rounded-full border-2 border-[#11110f] bg-[#4adeb0]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[#f3f0e8]">{clientName}</p>
          {clientEmail && (
            <p dir="ltr" className="truncate text-[11px] text-[#77766f]">
              {clientEmail}
            </p>
          )}
        </div>
      </div>
      <SignOutButton className="mt-3 h-9 w-full rounded-xl border-white/[0.07] bg-black/10 text-[#9e9b92] hover:bg-white/[0.05] hover:text-white" />
    </div>
  );

  const brand = (
    <Link href={base} className="group flex items-center gap-3">
      <span className="relative flex size-10 items-center justify-center overflow-hidden rounded-[14px] border border-[#d8be78]/25 bg-[#d8be78]/10 text-[#ead69e] shadow-[0_12px_36px_rgba(216,190,120,0.1)]">
        <Sparkles className="size-[19px] transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" strokeWidth={1.7} />
        <span className="absolute inset-x-2 bottom-0 h-px bg-gradient-to-r from-transparent via-[#ead69e] to-transparent" />
      </span>
      <span>
        <span className="block font-satoshi text-[17px] leading-none tracking-[-0.03em] text-[#f6f2e8]">
          {t("brand")}
        </span>
        <span className="mt-1 block text-[8px] font-semibold tracking-[0.26em] text-[#817b6c] uppercase">
          {t("ui.clientIntelligence")}
        </span>
      </span>
    </Link>
  );

  return (
    <div className="portal-shell portal-liquid relative min-h-screen overflow-x-hidden bg-[#05070d] text-[#e7e8ee]">
      <div aria-hidden className="portal-ambient pointer-events-none fixed inset-0" />
      <div aria-hidden className="portal-noise pointer-events-none fixed inset-0 opacity-40" />
      <div aria-hidden className="portal-aurora portal-aurora-one pointer-events-none fixed" />
      <div aria-hidden className="portal-aurora portal-aurora-two pointer-events-none fixed" />
      <div aria-hidden className="portal-aurora portal-aurora-three pointer-events-none fixed" />

      <div className="relative flex min-h-screen">
        <aside className="portal-glass-sidebar fixed inset-y-4 start-4 z-30 hidden min-h-0 w-[270px] flex-col overflow-hidden rounded-[32px] border border-white/[0.13] p-5 lg:flex">
          <div className="mb-7 shrink-0 px-2 pt-1">{brand}</div>
          <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto pe-1">
            {nav}
            {accountsNav}
          </div>

          <div className="shrink-0 border-t border-white/[0.07] pt-3">
            <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-[#54d8ac]/10 bg-[#54d8ac]/[0.045] px-3 py-2.5 text-[10px] font-medium tracking-[0.12em] text-[#78d9b9] uppercase">
              <ShieldCheck className="size-4" strokeWidth={1.8} aria-hidden />
              <span>{t("ui.secureWorkspace")}</span>
            </div>
            {identity}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col lg:ps-[302px]">
          <header className="portal-glass-topbar sticky top-3 z-20 mx-3 mt-3 flex h-[64px] items-center justify-between rounded-[22px] border border-white/[0.12] px-4 sm:mx-5 sm:px-6 lg:mx-8 lg:px-6">
            <div className="lg:hidden">{brand}</div>
            <div className="hidden items-center gap-2 lg:flex">
              <span className="size-1.5 animate-pulse rounded-full bg-[#55deb0] shadow-[0_0_14px_rgba(85,222,176,0.75)]" />
              <span className="text-[10px] font-semibold tracking-[0.18em] text-[#85837c] uppercase">
                {t("nav.label")}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[10px] text-[#8f8c84] sm:flex">
                <ShieldCheck className="size-3.5 text-[#d8be78]" strokeWidth={1.8} />
                {t("ui.verifiedBy")}
              </div>
              <Button
                variant="outline"
                size="icon"
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label={t("nav.open")}
                className="border-white/[0.08] bg-white/[0.03] text-[#c8c4b9] hover:bg-white/[0.07] lg:hidden"
              >
                <Menu className="size-4" aria-hidden />
              </Button>
            </div>
          </header>

          <main className="scrollbar-slim min-w-0 flex-1 px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10 xl:px-10">
            <div className="mx-auto w-full max-w-[1500px]">{children}</div>
          </main>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label={t("nav.close")}
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: locale === "ar" ? 36 : -36, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: locale === "ar" ? 36 : -36, opacity: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 34 }}
              className="portal-glass-sidebar absolute inset-y-3 start-3 flex min-h-0 w-[304px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[30px] border border-white/[0.13] p-4 shadow-2xl sm:p-5"
            >
              <div className="mb-7 flex shrink-0 items-center justify-between">
                {brand}
                <Button
                  variant="outline"
                  size="icon-sm"
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label={t("nav.close")}
                  className="border-white/[0.08] text-[#9d9a91]"
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
              <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto pe-1">
                {nav}
                {accountsNav}
              </div>
              <div className="shrink-0 border-t border-white/[0.07] pt-3">{identity}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
