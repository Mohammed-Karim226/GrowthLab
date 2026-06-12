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
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ background: "#ffffff", borderColor: "#e2e8f0" }}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <span className="text-xs font-semibold ml-3 font-sora" style={{ color: "#4a5568" }}>
            {isRTL ? "إنشاء رسالة جديدة" : "New Message"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <MinusCircle size={14} className="cursor-pointer hover:text-gray-600" />
          <Maximize2 size={13} className="cursor-pointer hover:text-gray-600" />
          <X size={14} className="cursor-pointer hover:text-gray-600" />
        </div>
      </div>

      {/* To field */}
      <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ background: "#ffffff", borderColor: "#e8eaf0" }}>
        <span className="text-xs font-semibold w-12 shrink-0 font-sora" style={{ color: "#5f6368" }}>{isRTL ? "إلى:" : "To:"}</span>
        <span className="flex-1 text-sm" style={{ color: "#202124", fontFamily: "Manrope, sans-serif" }}>
          {form.toEmail || "creator@example.com"}
        </span>
      </div>

      {/* Subject field */}
      <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ background: "#ffffff", borderColor: "#e8eaf0" }}>
        <span className="text-xs font-semibold w-12 shrink-0 font-sora" style={{ color: "#5f6368" }}>{isRTL ? "الموضوع:" : "Subject:"}</span>
        <span className="flex-1 text-sm font-semibold" style={{ color: "#202124", fontFamily: "Manrope, sans-serif" }}>{content.subject}</span>
      </div>
    </div>
  );
}
