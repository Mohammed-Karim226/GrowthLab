"use client";

import { Copy, Check, Globe, Youtube, Moon, Sun } from "lucide-react";
import type { Lang } from "@/lib/landing";

interface TopAppBarProps {
  lang: Lang;
  copied: boolean;
  onLangToggle: () => void;
  onCopy: () => void;
  theme: string | undefined;
  setTheme: (theme: string) => void;
}

export default function TopAppBar({ lang, copied, onLangToggle, onCopy, theme, setTheme }: TopAppBarProps) {
  const isRTL = lang === "ar";
  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-red-600 text-white px-2 py-1 rounded-md">
          <Youtube size={16} />
          <span className="text-xs font-bold tracking-wide hidden sm:inline">Outreach Workbench</span>
        </div>
        <span className="text-sidebar-foreground/40 text-sm hidden md:inline">|</span>
        <span className="text-sidebar-foreground/70 text-xs hidden md:inline">Creator Email Studio</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 cursor-pointer select-none border border-sidebar-border transition-all hover:bg-sidebar-accent">
          {theme === "dark" ? <Sun size={14} className="text-sidebar-foreground/80" /> : <Moon size={14} className="text-sidebar-foreground/80" />}
        </button>
        <div className="flex items-center gap-2 rounded-full px-3 py-1.5 cursor-pointer select-none border border-sidebar-border transition-all hover:bg-sidebar-accent"
          onClick={onLangToggle}>
          <Globe size={14} className="text-sidebar-foreground/80" />
          <span className="text-xs font-semibold text-sidebar-foreground/90">
            {isRTL ? "English / EN" : "عربي / AR"}
          </span>
        </div>
        <button onClick={onCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all bg-primary text-primary-foreground hover:bg-primary/90">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? (isRTL ? "تم النسخ!" : "Copied!") : (isRTL ? "نسخ HTML" : "Copy HTML")}
        </button>
      </div>
    </header>
  );
}
