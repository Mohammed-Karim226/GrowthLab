"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { FileText, LayoutDashboard, Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import SignOutButton from "@/components/auth/SignOutButton";

type PortalShellProps = {
  clientName: string;
  clientEmail: string | null;
  children: React.ReactNode;
};

const NAV = [
  { key: "overview", href: "", icon: LayoutDashboard },
  { key: "reports", href: "/reports", icon: FileText },
] as const;

/**
 * Client chrome, deliberately the same shape as the admin shell so the two
 * surfaces feel like one product.
 *
 * The nav is presentation only: every page behind it calls `requireClient`
 * again, and RLS filters the rows a second time (plan §43).
 */
export default function PortalShell({ clientName, clientEmail, children }: PortalShellProps) {
  const t = useTranslations("portal");
  const locale = useLocale();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const base = `/${locale}/portal`;

  function isActive(href: string) {
    const full = `${base}${href}`;
    return href === "" ? pathname === full || pathname === `${full}/` : pathname.startsWith(full);
  }

  const nav = (
    <nav className="flex flex-col gap-1" aria-label={t("nav.label")}>
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
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-white/[0.08] text-white"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {t(`nav.${item.key}` as never)}
          </Link>
        );
      })}
    </nav>
  );

  const identity = (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="truncate text-sm text-white">{clientName}</p>
      {clientEmail && (
        <p dir="ltr" className="truncate text-xs text-slate-500">
          {clientEmail}
        </p>
      )}
      <SignOutButton className="mt-3 w-full" />
    </div>
  );

  return (
    <div className="relative min-h-screen bg-[#070b1e] text-slate-200">
      <div aria-hidden className="pointer-events-none fixed inset-0 hero-grid opacity-40" />

      <div className="relative flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col justify-between border-e border-white/[0.06] bg-white/[0.02] p-5 lg:flex">
          <div className="space-y-8">
            <Link href={`/${locale}`} className="flex items-center gap-2.5">
              <Image src="/images/strategy.png" alt="" width={26} height={26} />
              <span className="font-satoshi text-base text-white">{t("brand")}</span>
            </Link>
            {nav}
          </div>
          {identity}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 lg:hidden">
            <Link href={base} className="flex items-center gap-2">
              <Image src="/images/strategy.png" alt="" width={22} height={22} />
              <span className="font-satoshi text-sm text-white">{t("brand")}</span>
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t("nav.open")}
              className="rounded-lg border border-white/10 p-2 text-slate-300"
            >
              <Menu className="size-4" aria-hidden />
            </button>
          </header>

          <main className="scrollbar-slim min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
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
          <div className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col justify-between border-e border-white/10 bg-[#080d24] p-5">
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <span className="font-satoshi text-base text-white">{t("brand")}</span>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label={t("nav.close")}
                  className="rounded-lg border border-white/10 p-1.5 text-slate-300"
                >
                  <X className="size-4" aria-hidden />
                </button>
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
