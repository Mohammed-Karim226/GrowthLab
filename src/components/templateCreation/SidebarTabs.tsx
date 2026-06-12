"use client";

import type { Lang } from "@/lib/landing";

interface SidebarTabsProps {
  activeTab: "settings" | "content";
  onTabChange: (tab: "settings" | "content") => void;
  lang: Lang;
}

export default function SidebarTabs({ activeTab, onTabChange, lang }: SidebarTabsProps) {
  const isRTL = lang === "ar";
  return (
    <div className="flex border-b" style={{ borderColor: "#3d4d63" }}>
      <button
        onClick={() => onTabChange("settings")}
        className="flex-1 py-2.5 text-xs font-bold tracking-wide transition-all font-sora"
        style={{
          color: activeTab === "settings" ? "#e2e8f0" : "#718096",
          background: activeTab === "settings" ? "#1a2535" : "transparent",
          borderBottom: activeTab === "settings" ? "2px solid #63b3ed" : "2px solid transparent",
        }}>
        {isRTL ? "⚙️ الإعدادات" : "⚙️ Settings"}
      </button>
      <button
        onClick={() => onTabChange("content")}
        className="flex-1 py-2.5 text-xs font-bold tracking-wide transition-all font-sora"
        style={{
          color: activeTab === "content" ? "#e2e8f0" : "#718096",
          background: activeTab === "content" ? "#1a2535" : "transparent",
          borderBottom: activeTab === "content" ? "2px solid #63b3ed" : "2px solid transparent",
        }}>
        {isRTL ? "✏️ المحتوى" : "✏️ Edit Copy"}
      </button>
    </div>
  );
}
