"use client";

import GmailPreviewHeader from "./GmailPreviewHeader";
import EmailBodyPreview from "./EmailBodyPreview";
import GmailToolbarFooter from "./GmailToolbarFooter";
import Badge from "./Badge";
import type { FormState, ContentState, Lang } from "@/lib/landing";

interface GmailPreviewProps {
  form: FormState;
  content: ContentState;
  copied: boolean;
  onCopy: () => void;
  lang: Lang;
}

export default function GmailPreview({ form, content, copied, onCopy, lang }: GmailPreviewProps) {
  const isRTL = lang === "ar";
  return (
    <main className="flex-1 flex flex-col min-h-0 overflow-y-auto p-3 md:p-6" style={{ background: "#f0f2f5" }}>
      <div className="w-full max-w-3xl mx-auto">
        <GmailPreviewHeader form={form} content={content} lang={lang} />
        <EmailBodyPreview form={form} content={content} lang={lang} />
        <GmailToolbarFooter copied={copied} onCopy={onCopy} lang={lang} />
      </div>

      {/* Info badges */}
      <div className="w-full max-w-3xl mx-auto mt-4 flex flex-wrap gap-2 justify-center">
        <Badge label={isRTL ? "اللغة" : "Language"} value={isRTL ? "العربية (RTL)" : "English (LTR)"} />
        <Badge label={isRTL ? "النبرة" : "Tone"} value={form.tone === "professional" ? (isRTL ? "احترافي" : "Professional") : (isRTL ? "ودّي" : "Friendly")} />
        <Badge label={isRTL ? "القناة" : "Channel"} value={form.channelName || "—"} />
        <Badge label={isRTL ? "رابط الحجز" : "CTA"} value={form.bookingLink ? (isRTL ? "متاح ✓" : "Active ✓") : (isRTL ? "غير محدد" : "Not set")} />
      </div>
    </main>
  );
}
