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
    <div className="rounded-b-lg flex items-center justify-between px-4 py-2.5 border-t shadow-md bg-card border-border">
      <div className="flex items-center gap-2">
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all bg-primary text-primary-foreground hover:bg-primary/90">
          {copied ? <Check size={14} /> : <Send size={14} />}
          {copied ? (isRTL ? "تم النسخ ✓" : "Copied ✓") : (isRTL ? "نسخ HTML" : "Copy HTML")}
        </button>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Paperclip size={16} className="cursor-pointer hover:text-foreground mx-1" />
          <Mail size={16} className="cursor-pointer hover:text-foreground mx-1" />
          <MoreVertical size={16} className="cursor-pointer hover:text-foreground mx-1" />
        </div>
      </div>
      <Trash2 size={15} className="cursor-pointer text-muted-foreground hover:text-red-400 transition-colors" />
    </div>
  );
}
