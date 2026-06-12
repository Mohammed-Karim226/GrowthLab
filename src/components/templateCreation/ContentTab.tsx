"use client";

import { RefreshCw } from "lucide-react";
import SideSection from "./SideSection";
import SideField from "./SideField";
import ContentTextArea from "./ContentTextArea";
import { ContentState, Lang } from "@/lib/landing";


interface ContentTabProps {
  content: ContentState;
  onUpdate: (key: keyof ContentState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onReset: () => void;
  lang: Lang;
}

export default function ContentTab({ content, onUpdate, onReset, lang }: ContentTabProps) {
  const isRTL = lang === "ar";
  return (
    <>
      {/* Content Editor Tab */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold tracking-wide text-muted-foreground">
          {isRTL ? "تحرير نص البريد الإلكتروني" : "EDIT EMAIL COPY"}
        </span>
        <button
          onClick={onReset}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all bg-sidebar-accent text-muted-foreground border border-sidebar-border hover:text-sidebar-foreground"
          title={isRTL ? "إعادة تعيين للافتراضي" : "Reset to defaults"}>
          <RefreshCw size={11} />
          {isRTL ? "إعادة" : "Reset"}
        </button>
      </div>

      <SideSection title={isRTL ? "سطر الموضوع" : "Subject Line"} icon="📧">
        <SideField
          label={isRTL ? "الموضوع" : "Subject"}
          value={content.subject}
          onChange={onUpdate("subject")}
          placeholder="Email subject line..."
        />
      </SideSection>

      <SideSection title={isRTL ? "نص البريد" : "Email Body"} icon="📝">
        <ContentTextArea
          label={isRTL ? "التحية" : "Greeting"}
          value={content.greeting}
          onChange={onUpdate("greeting")}
          rows={2}
        />
        <ContentTextArea
          label={isRTL ? "الجملة الافتتاحية (Hook)" : "Opening Hook"}
          value={content.hook}
          onChange={onUpdate("hook")}
          rows={4}
        />
        <ContentTextArea
          label={isRTL ? "الفقرة الرئيسية" : "Main Body"}
          value={content.body}
          onChange={onUpdate("body")}
          rows={5}
        />
        <ContentTextArea
          label={isRTL ? "الختام" : "Closing"}
          value={content.closing}
          onChange={onUpdate("closing")}
          rows={3}
        />
      </SideSection>

      <SideSection title={isRTL ? "الدعوة للتصرف" : "CTA & Sign-off"} icon="🔗">
        <SideField
          label={isRTL ? "نص زر الدعوة للتصرف" : "CTA Button Text"}
          value={content.cta}
          onChange={onUpdate("cta")}
          placeholder="Schedule a Call..."
        />
        <SideField
          label={isRTL ? "ختام التوقيع" : "Sign-off"}
          value={content.signoff}
          onChange={onUpdate("signoff")}
          placeholder="Warm regards,"
        />
      </SideSection>

      <div className="rounded-lg p-3 text-xs bg-sidebar-accent text-muted-foreground border-l-3 rtl:border-l-0 rtl:border-r-3 border-sidebar-primary">
        {isRTL ? "✦ تعديلاتك تظهر مباشرةً في المعاينة. اضغط على \"إعادة\" للعودة إلى النص الافتراضي." : "✦ Your edits appear live in the preview. Press Reset to restore default copy."}
      </div>
    </>
  );
}
