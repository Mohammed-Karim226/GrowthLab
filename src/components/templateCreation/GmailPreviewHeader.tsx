"use client";

import { MinusCircle, Maximize2, X } from "lucide-react";
import type { FormState, ContentState, Lang } from "@/lib/landing";

interface GmailPreviewHeaderProps {
  form: FormState;
  content: ContentState;
  lang: Lang;
}

export default function GmailPreviewHeader({ form, content, lang }: GmailPreviewHeaderProps) {
  const isRTL = lang === "ar";
  return (
    <div className="rounded-t-lg overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-card border-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <span className="text-xs font-semibold ml-3 text-muted-foreground">
            {isRTL ? "إنشاء رسالة جديدة" : "New Message"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <MinusCircle size={14} className="cursor-pointer hover:text-foreground" />
          <Maximize2 size={13} className="cursor-pointer hover:text-foreground" />
          <X size={14} className="cursor-pointer hover:text-foreground" />
        </div>
      </div>

      {/* To field */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-card border-border">
        <span className="text-xs font-semibold w-12 shrink-0 text-muted-foreground">{isRTL ? "إلى:" : "To:"}</span>
        <span className="flex-1 text-sm text-foreground">
          {form.toEmail || "creator@example.com"}
        </span>
      </div>

      {/* Subject field */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-card border-border">
        <span className="text-xs font-semibold w-12 shrink-0 text-muted-foreground">{isRTL ? "الموضوع:" : "Subject:"}</span>
        <span className="flex-1 text-sm font-semibold text-foreground">{content.subject}</span>
      </div>
    </div>
  );
}
