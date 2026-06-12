'use client';

import { useState, useCallback, useEffect } from "react";
import { useTheme } from "next-themes";
import TopAppBar from "@/components/templateCreation/TopAppBar";
import Sidebar from "@/components/templateCreation/Sidebar";
import GmailPreview from "@/components/templateCreation/GmailPreview";
import { toneMap, getDefaultContent, generateHTML, copyHTMLToClipboard } from "@/lib/utils";
import type { FormState, ContentState, Lang, Tone } from "@/lib/landing";

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [lang, setLang] = useState<Lang>("en");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"settings" | "content">("settings");
  const [form, setForm] = useState<FormState>({
    creatorName: "Alex Johnson",
    channelName: "TechWithAlex",
    logoUrl: "",
    bookingLink: "https://growth-lab-lac.vercel.app/ar",
    whatsappLink:"https://wa.me/201126421602",
    tone: "professional",
    senderName: "Sarah Mitchell",
    senderTitle: "Head of Creator Partnerships",
    senderEmail: "sarah@brandname.com",
    toEmail: "",
  });

  const [content, setContent] = useState<ContentState>(() =>
    getDefaultContent("en", "professional", "Alex Johnson")
  );

  // When tone or lang changes, reset content to defaults (but keep any manual edits as optional)
  const resetContent = useCallback(() => {
    setContent(getDefaultContent(lang, form.tone as Tone, form.creatorName));
  }, [lang, form.tone, form.creatorName]);

  // Sync greeting when creatorName changes only if it still matches the template pattern
  useEffect(() => {
    const defaultGreeting = toneMap[lang][form.tone as Tone].greeting(form.creatorName);
    setContent((prev) => ({ ...prev, greeting: defaultGreeting }));
  }, [form.creatorName, lang, form.tone]);

  const isRTL = lang === "ar";

  const updateForm = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((prev) => ({ ...prev, logoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const updateContent = (key: keyof ContentState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setContent((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleToneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTone = e.target.value as Tone;
    setForm((prev) => ({ ...prev, tone: newTone }));
    setContent(getDefaultContent(lang, newTone, form.creatorName));
  };

  const handleLangToggle = () => {
    const newLang = isRTL ? "en" : "ar";
    setLang(newLang);
    setContent(getDefaultContent(newLang, form.tone as Lang as any , form.creatorName));
  };

  const handleCopy = useCallback(() => {
    const html = generateHTML(form, content, lang, false); // false = no full document wrapper (Gmail-friendly)
    copyHTMLToClipboard(html).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      // Last resort: open HTML in new tab
      const fullHtml = generateHTML(form, content, lang, true);
      const blob = new Blob([fullHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    });
  }, [form, content, lang]);

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen flex flex-col bg-background text-foreground">
      <TopAppBar lang={lang} copied={copied} onLangToggle={handleLangToggle} onCopy={handleCopy} theme={theme} setTheme={setTheme} />
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          form={form}
          content={content}
          onFormUpdate={updateForm}
          onContentUpdate={updateContent}
          onToneChange={handleToneChange}
          onResetContent={resetContent}
          onLogoFileUpload={handleLogoFileUpload}
          lang={lang}
        />
        <GmailPreview form={form} content={content} copied={copied} onCopy={handleCopy} lang={lang} />
      </div>
    </div>
  );
}
