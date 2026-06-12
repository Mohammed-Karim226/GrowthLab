"use client";

import SidebarTabs from "./SidebarTabs";
import SettingsTab from "./SettingsTab";
import ContentTab from "./ContentTab";
import type { FormState, ContentState, Lang } from "@/lib/landing";

interface SidebarProps {
  activeTab: "settings" | "content";
  onTabChange: (tab: "settings" | "content") => void;
  form: FormState;
  content: ContentState;
  onFormUpdate: (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onContentUpdate: (key: keyof ContentState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onToneChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onResetContent: () => void;
  lang: Lang;
}

export default function Sidebar({ activeTab, onTabChange, form, content, onFormUpdate, onContentUpdate, onToneChange, onResetContent, lang }: SidebarProps) {
  return (
    <aside className="w-full lg:w-80 xl:w-96 flex-shrink-0 overflow-y-auto bg-sidebar text-sidebar-foreground">
      <SidebarTabs activeTab={activeTab} onTabChange={onTabChange} lang={lang} />
      <div className="p-4 space-y-5">
        {activeTab === "settings" ? (
          <SettingsTab form={form} onUpdate={onFormUpdate} onToneChange={onToneChange} lang={lang} />
        ) : (
          <ContentTab content={content} onUpdate={onContentUpdate} onReset={onResetContent} lang={lang} />
        )}
      </div>
    </aside>
  );
}
