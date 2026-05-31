"use client";

import { useState } from "react";
import { Menu, X, Youtube } from "lucide-react";

type NavBarProps = {
  navLinks: string[];
  scrolled: boolean;
};

export default function NavBar({ navLinks, scrolled }: NavBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "glass shadow-lg" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0891B2] to-[#3B82F6] text-white shadow-lg">
            <Youtube className="h-5 w-5" />
          </div>
          <span className="font-satoshi text-lg text-white">GrowthLab</span>
        </div>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-slate-400 transition hover:text-white"
            >
              {link}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href="#contact"
            className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-white transition hover:border-[#0891B2]/50"
          >
            Sign In
          </a>
          <a
            href="#contact"
            className="rounded-full bg-gradient-to-r from-[#0891B2] to-[#0671A1] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-95"
          >
            Book Free Call
          </a>
        </div>

        <button
          type="button"
          className="inline-flex items-center rounded-full p-2 text-white md:hidden"
          onClick={() => setMobileMenuOpen((current) => !current)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="mx-auto max-w-7xl border-t border-white/10 bg-[#0A0E27]/95 px-4 py-4 backdrop-blur-xl sm:px-6 md:hidden">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-slate-300 transition hover:text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link}
              </a>
            ))}
            <a
              href="#contact"
              className="rounded-full bg-gradient-to-r from-[#0891B2] to-[#0671A1] px-5 py-3 text-center text-sm font-semibold text-white"
              onClick={() => setMobileMenuOpen(false)}
            >
              Book Free Call
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
