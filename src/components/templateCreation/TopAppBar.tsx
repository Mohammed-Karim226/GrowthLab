"use client";

import { Copy, Check, Globe, Youtube } from "lucide-react";
import type { Lang } from "@/lib/landing";

interface TopAppBarProps {
  lang: Lang;
  copied: boolean;
  onLangToggle: () => void;
  onCopy: () => void;
}

export default function TopAppBar({ lang, copied, onLangToggle, onCopy }: TopAppBarProps) {
  const isRTL = lang === "ar";
  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b shadow-sm" style={{ background: "#2d3748", borderColor: "#3d4d63" }}>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-red-600 text-white px-2 py-1 rounded-md">
          <Youtube size={16} />
          <span className="text-xs font-bold font-sora tracking-wide hidden sm:inline">Outreach Workbench</span>
        </div>
        <span className="text-white/40 text-sm hidden md:inline">|</span>
        <span className="text-white/70 text-xs hidden md:inline font-sora">Creator Email Studio</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full px-3 py-1.5 cursor-pointer select-none border border-white/20 transition-all" style={{ background: isRTL ? "#4a5568" : "transparent" }}
          onClick={onLangToggle}>
          <Globe size={14} className="text-white/80" />
          <span className="text-xs font-semibold text-white/90 font-sora">
            {isRTL ? "English / EN" : "عربي / AR"}
          </span>
        </div>
        <button onClick={onCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
          style={{ background: copied ? "#48bb78" : "#4a5568", color: "white" }}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? (isRTL ? "تم النسخ!" : "Copied!") : (isRTL ? "نسخ HTML" : "Copy HTML")}
        </button>
      </div>
    </header>
  );
}
