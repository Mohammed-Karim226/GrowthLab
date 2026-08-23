"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  BarChart3,
  FilePenLine,
  Menu,
  ShieldCheck,
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
  { key: "overview", href: "", icon: BarChart3 },
  { key: "clients", href: "/clients", icon: Users },
  { key: "templateCreation", href: "/template-creation", icon: FilePenLine },
] as const;

export default function AdminShell({
  adminName,
  adminEmail,
  children,
}: AdminShellProps) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const base = `/${locale}/admin`;
  const isActive = (href: string) =>
    href === ""
      ? pathname === base || pathname === `${base}/`
      : pathname.startsWith(`${base}${href}`);
  const nav = (
    <nav className="space-y-1.5" aria-label={t("nav.label")}>
      {NAV.map(({ key, href, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={key}
            href={`${base}${href}`}
            onClick={() => setMenuOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-colors",
              active ? "text-[#f8f5ec]" : "text-[#8f8e88] hover:text-[#dedbd1]",
            )}
          >
            {active && (
              <span className="absolute inset-0 rounded-2xl border border-white/[0.08] bg-white/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" />
            )}
            <span
              className={cn(
                "relative flex size-9 shrink-0 items-center justify-center rounded-xl border transition-all",
                active
                  ? "border-[#d8be78]/25 bg-[#d8be78]/10 text-[#e5cd8c]"
                  : "border-white/[0.06] bg-white/[0.025] text-[#77766f] group-hover:border-white/10 group-hover:text-[#c9c5ba]",
              )}
            >
              <Icon className="size-[17px]" strokeWidth={1.8} aria-hidden />
            </span>
            <span className="relative flex-1">{t(`nav.${key}` as never)}</span>
          </Link>
        );
      })}
    </nav>
  );
  const identity = (
    <div className="portal-admin-identity rounded-[22px] border border-white/[0.07] bg-white/[0.035] p-3.5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ead69e] to-[#a8863f] text-sm font-bold text-[#17150f]">
          {adminName.trim().charAt(0).toUpperCase() || "G"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#f3f0e8]">
            {adminName}
          </p>
          {adminEmail && (
            <p dir="ltr" className="truncate text-[11px] text-[#77766f]">
              {adminEmail}
            </p>
          )}
        </div>
      </div>
      <SignOutButton className="mt-3 h-9 w-full rounded-xl border-white/[0.07] bg-black/10 text-[#9e9b92] hover:bg-white/[0.05] hover:text-white" />
    </div>
  );
  const brand = (
    <Link href={base} className="group flex items-center gap-3">
      <span className="portal-admin-mark flex size-10 items-center justify-center rounded-[14px] border border-[#d8be78]/25 bg-[#d8be78]/10 text-[#ead69e]">
        <ShieldCheck className="size-[19px]" strokeWidth={1.7} />
      </span>
      <span>
        <span className="block font-satoshi text-[17px] leading-none text-[#f6f2e8]">
          {t("brand")}
        </span>
        <span className="mt-1 block text-[8px] font-semibold tracking-[0.26em] text-[#817b6c] uppercase">
          {t("vipConsole")}
        </span>
      </span>
    </Link>
  );
  return (
    <div className="portal-shell portal-liquid relative min-h-screen overflow-x-hidden bg-[#05070d] text-[#e7e8ee]">
      <div
        aria-hidden
        className="portal-ambient pointer-events-none fixed inset-0"
      />
      <div
        aria-hidden
        className="portal-noise pointer-events-none fixed inset-0 opacity-40"
      />
      <div
        aria-hidden
        className="portal-aurora portal-aurora-one pointer-events-none fixed"
      />
      <div
        aria-hidden
        className="portal-aurora portal-aurora-two pointer-events-none fixed"
      />
      <div
        aria-hidden
        className="portal-aurora portal-aurora-three pointer-events-none fixed"
      />
      <div className="relative flex min-h-screen">
        <aside className="portal-glass-sidebar fixed inset-y-4 start-4 z-30 hidden min-h-0 w-[270px] flex-col overflow-hidden rounded-[32px] border border-white/[0.13] p-5 lg:flex">
          <div className="mb-7 shrink-0 px-2 pt-1">{brand}</div>
          <div className="min-h-0 flex-1 overflow-y-auto pe-1">{nav}</div>
          <div className="shrink-0 border-t border-white/[0.07] pt-3">
            {identity}
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col lg:ps-[302px]">
          <header className="portal-glass-topbar fixed inset-x-3 top-3 z-20 flex h-[64px] items-center justify-between rounded-[22px] border border-white/[0.14] px-4 sm:inset-x-5 sm:px-6 lg:sticky lg:inset-x-auto lg:mx-8 lg:mt-3 lg:px-6">
            <div className="lg:hidden">{brand}</div>
            <div className="hidden items-center gap-2 lg:flex">
              <span className="size-1.5 animate-pulse rounded-full bg-[#55deb0] shadow-[0_0_14px_rgba(85,222,176,0.75)]" />
              <span className="text-[10px] font-semibold tracking-[0.18em] text-[#85837c] uppercase">
                {t("nav.label")}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[10px] text-[#8f8c84] sm:flex">
                <ShieldCheck
                  className="size-3.5 text-[#d8be78]"
                  strokeWidth={1.8}
                />
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
          <main className="scrollbar-slim min-w-0 flex-1 px-4 pb-7 pt-[92px] sm:px-6 sm:pb-9 sm:pt-[100px] lg:px-8 lg:py-10 xl:px-10">
            <div className="mx-auto w-full max-w-[1500px] space-y-6">
              {children}
            </div>
          </main>
        </div>
      </div>
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t("nav.close")}
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />
          <div className="portal-glass-sidebar absolute inset-y-3 start-3 flex min-h-0 w-[304px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[30px] border border-white/[0.13] p-4 shadow-2xl sm:p-5">
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
            <div className="min-h-0 flex-1 overflow-y-auto pe-1">{nav}</div>
            <div className="shrink-0 border-t border-white/[0.07] pt-3">
              {identity}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
