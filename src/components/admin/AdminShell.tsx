"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Crown,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import SignOutButton from "@/components/auth/SignOutButton";
import { Button } from "@/components/ui/button";

type AdminShellProps = {
  adminName: string;
  adminEmail: string | null;
  children: React.ReactNode;
};

const NAV = [
  { key: "overview", href: "", icon: LayoutDashboard },
  { key: "clients", href: "/clients", icon: Users },
] as const;

/**
 * Admin chrome: fixed sidebar on desktop, slide-over on mobile.
 *
 * Navigation is presentation only — every page behind it re-checks the session
 * server-side, so hiding a link is never what keeps a non-admin out.
 */
export default function AdminShell({ adminName, adminEmail, children }: AdminShellProps) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const base = `/${locale}/admin`;

  function isActive(href: string) {
    const full = `${base}${href}`;
    return href === "" ? pathname === full || pathname === `${full}/` : pathname.startsWith(full);
  }

  const nav = (
    <nav className="flex flex-col gap-1.5" aria-label={t("nav.label")}>
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
              "admin-nav-item group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3.5 py-3 text-sm transition-all duration-300",
              active
                ? "is-active text-[#fff6d8]"
                : "text-slate-400 hover:text-slate-100"
            )}
          >
            <span className="admin-nav-icon relative z-10 flex size-8 shrink-0 items-center justify-center rounded-xl">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="relative z-10">{t(`nav.${item.key}` as never)}</span>
            {active && <Sparkles className="relative z-10 ms-auto size-3.5 text-[#f8d675]" aria-hidden />}
          </Link>
        );
      })}
    </nav>
  );

  const identity = (
    <div className="admin-identity relative overflow-hidden rounded-2xl p-3.5">
      <div className="relative z-10 flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#efd787]/20 bg-[#efd787]/10 text-[#f4d77d]">
          <ShieldCheck className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="mb-0.5 flex items-center gap-1.5">
            <p className="truncate text-sm font-medium text-white">{adminName}</p>
            <Crown className="size-3 shrink-0 text-[#f4d77d]" aria-hidden />
          </div>
          {adminEmail && (
            <p dir="ltr" className="truncate text-[11px] text-slate-500">
              {adminEmail}
            </p>
          )}
        </div>
      </div>
      <SignOutButton className="mt-3 w-full" />
    </div>
  );

  return (
    <div className="admin-vip relative h-dvh overflow-hidden bg-[#050711] text-slate-200">
      <div aria-hidden className="admin-vip-ambient pointer-events-none fixed inset-0" />
      <div aria-hidden className="admin-vip-orb admin-vip-orb-one pointer-events-none fixed" />
      <div aria-hidden className="admin-vip-orb admin-vip-orb-two pointer-events-none fixed" />
      <div aria-hidden className="pointer-events-none fixed inset-0 hero-grid opacity-25" />
      <div aria-hidden className="admin-vip-noise pointer-events-none fixed inset-0" />

      <div className="relative flex h-full">
        <aside className="admin-vip-sidebar scrollbar-slim z-30 hidden w-72 flex-col justify-between overflow-y-auto p-5 lg:flex">
          <div className="space-y-9">
            <Link href={`/${locale}`} className="group flex items-center gap-3 px-1">
              <span className="admin-vip-logo relative flex size-11 items-center justify-center rounded-2xl">
                <Image src="/images/strategy.png" alt="" width={25} height={25} className="relative z-10" />
                <Crown className="absolute -end-1 -top-1 z-20 size-3.5 rotate-12 text-[#f8d675] drop-shadow-[0_0_8px_rgba(248,214,117,.65)]" aria-hidden />
              </span>
              <span>
                <span className="block font-satoshi text-base text-white">{t("brand")}</span>
                <span className="mt-0.5 flex items-center gap-1 text-[9px] font-semibold tracking-[0.22em] text-[#d5b85e] uppercase">
                  <Sparkles className="size-2.5" aria-hidden /> {t("vipConsole")}
                </span>
              </span>
            </Link>
            {nav}
          </div>
          {identity}
        </aside>

        <div className="flex h-full min-w-0 flex-1 flex-col lg:ps-72">
          <header className="admin-vip-mobile-header flex items-center justify-between gap-3 px-4 py-3 lg:hidden">
            <Link href={`/${locale}/admin`} className="flex items-center gap-2">
              <span className="admin-vip-logo flex size-9 items-center justify-center rounded-xl">
                <Image src="/images/strategy.png" alt="" width={20} height={20} />
              </span>
              <span className="font-satoshi text-sm text-white">{t("brand")}</span>
            </Link>
            <Button
              variant="outline"
              size="icon"
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t("nav.open")}
              className="border-[#e9cd72]/15 bg-[#e9cd72]/[0.06] text-[#ead581] hover:bg-[#e9cd72]/10"
            >
              <Menu className="size-4" aria-hidden />
            </Button>
          </header>

          <main className="admin-vip-main scrollbar-slim min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-6 sm:px-6 lg:px-10 lg:py-9 xl:px-12">
            <div className="mx-auto w-full max-w-[96rem]">{children}</div>
          </main>
        </div>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t("nav.close")}
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="admin-vip-drawer absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col justify-between p-5">
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-satoshi text-base text-white">
                  <Crown className="size-4 text-[#f4d77d]" aria-hidden />
                  {t("brand")}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label={t("nav.close")}
                  className="border-white/10 text-slate-300"
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
              {nav}
            </div>
            {identity}
          </div>
        </div>
      )}
    </div>
  );
}
