"use client";

import { Copy, Check, Send, Paperclip, Mail, MoreVertical, Trash2 } from "lucide-react";
import type { Lang } from "@/lib/landing";

interface GmailToolbarFooterProps {
  copied: boolean;
  onCopy: () => void;
  lang: Lang;
}

export default function GmailToolbarFooter({ copied, onCopy, lang }: GmailToolbarFooterProps) {
  const isRTL = lang === "ar";
  return (
    <div className="rounded-b-lg flex items-center justify-between px-4 py-2.5 border-t shadow-md" style={{ background: "#ffffff", borderColor: "#e2e8f0" }}>
      <div className="flex items-center gap-2">
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all font-sora"
          style={{ background: copied ? "#48bb78" : "#2d3748", color: "white" }}>
          {copied ? <Check size={14} /> : <Send size={14} />}
          {copied ? (isRTL ? "تم النسخ ✓" : "Copied ✓") : (isRTL ? "نسخ HTML" : "Copy HTML")}
        </button>
        <div className="flex items-center gap-1 text-gray-400">
          <Paperclip size={16} className="cursor-pointer hover:text-gray-600 mx-1" />
          <Mail size={16} className="cursor-pointer hover:text-gray-600 mx-1" />
          <MoreVertical size={16} className="cursor-pointer hover:text-gray-600 mx-1" />
        </div>
      </div>
      <Trash2 size={15} className="cursor-pointer text-gray-400 hover:text-red-400 transition-colors" />
    </div>
  );
}
