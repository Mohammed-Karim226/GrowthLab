"use client";

import SideSection from "./SideSection";
import SideField from "./SideField";
import ToneSelector from "./ToneSelector";
import type { FormState, Lang } from "@/lib/landing";

interface SettingsTabProps {
  form: FormState;
  onUpdate: (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onToneChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onLogoFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  lang: Lang;
}

export default function SettingsTab({ form, onUpdate, onToneChange, onLogoFileUpload, lang }: SettingsTabProps) {
  const isRTL = lang === "ar";
  return (
    <>
      {/* Section: Recipient */}
      <SideSection title={isRTL ? "معلومات المستلم" : "Recipient Info"} icon="👤">
        <SideField label={isRTL ? "اسم المنشئ" : "Creator Name"} value={form.creatorName} onChange={onUpdate("creatorName")} placeholder={isRTL ? "أحمد الخالد" : "Alex Johnson"} />
        <SideField label={isRTL ? "اسم القناة" : "Channel Name"} value={form.channelName} onChange={onUpdate("channelName")} placeholder={isRTL ? "قناة تقنية" : "TechWithAlex"} />
        <SideField label={isRTL ? "بريد المستلم" : "To: Email"} value={form.toEmail} onChange={onUpdate("toEmail")} placeholder="creator@example.com" />
      </SideSection>

      {/* Section: Media */}
      <SideSection title={isRTL ? "الوسائط والروابط" : "Media & Links"} icon="🖼️">
        <div className="space-y-3 mb-3">
          <div className="text-sm font-medium text-sidebar-foreground">
            {isRTL ? "الشعار / الصورة" : "Logo / Profile Image"}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={onLogoFileUpload}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
          />
          <SideField 
            label={isRTL ? "أو استخدم رابط" : "Or use a URL"} 
            value={form.logoUrl} 
            onChange={onUpdate("logoUrl")} 
            placeholder="https://example.com/logo.png" 
          />
        </div>
        <SideField label={isRTL ? "رابط الحجز" : "Booking Link"} value={form.bookingLink} onChange={onUpdate("bookingLink")} placeholder="https://calendly.com/yourbrand" />
        <SideField label={isRTL ? "رابط الواتس اب" : "WhatsApp Link"} value={form.whatsappLink} onChange={onUpdate("whatsappLink")} placeholder="https://wa.me/201234567890" />
      </SideSection>

      {/* Section: Tone */}
      <SideSection title={isRTL ? "نبرة البريد" : "Email Tone"} icon="🎙️">
        <ToneSelector tone={form.tone} onChange={onToneChange} lang={lang} />
      </SideSection>

      {/* Section: Sender */}
      <SideSection title={isRTL ? "معلومات المُرسِل" : "Sender Details"} icon="✍️">
        <SideField label={isRTL ? "اسمك" : "Your Name"} value={form.senderName} onChange={onUpdate("senderName")} placeholder={isRTL ? "سارة المطيري" : "Sarah Mitchell"} />
        <SideField label={isRTL ? "مسمى وظيفي" : "Title / Role"} value={form.senderTitle} onChange={onUpdate("senderTitle")} placeholder={isRTL ? "مدير الشراكات" : "Head of Creator Partnerships"} />
        <SideField label={isRTL ? "بريدك الإلكتروني" : "Your Email"} value={form.senderEmail} onChange={onUpdate("senderEmail")} placeholder="sarah@brand.com" />
      </SideSection>

      {/* Preview note */}
      <div className="rounded-lg p-3 text-xs bg-sidebar-accent text-muted-foreground border-l-3 rtl:border-l-0 rtl:border-r-3 border-border">
        {isRTL ? "✦ المعاينة تتحدث آنياً — انسخ HTML لاستخدامه في Gmail أو أي عميل بريد" : "✦ Preview updates live — Copy HTML to use in Gmail or any mail client"}
      </div>
    </>
  );
}
