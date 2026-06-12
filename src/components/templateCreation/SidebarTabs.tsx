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
    <div className="flex border-b border-sidebar-border">
      <button
        onClick={() => onTabChange("settings")}
        className="flex-1 py-2.5 text-xs font-bold tracking-wide transition-all"
        style={{
          color: activeTab === "settings" ? "var(--sidebar-foreground)" : "var(--muted-foreground)",
          background: activeTab === "settings" ? "var(--sidebar-accent)" : "transparent",
          borderBottom: activeTab === "settings" ? "2px solid var(--sidebar-primary)" : "2px solid transparent",
        }}>
        {isRTL ? "⚙️ الإعدادات" : "⚙️ Settings"}
      </button>
      <button
        onClick={() => onTabChange("content")}
        className="flex-1 py-2.5 text-xs font-bold tracking-wide transition-all"
        style={{
          color: activeTab === "content" ? "var(--sidebar-foreground)" : "var(--muted-foreground)",
          background: activeTab === "content" ? "var(--sidebar-accent)" : "transparent",
          borderBottom: activeTab === "content" ? "2px solid var(--sidebar-primary)" : "2px solid transparent",
        }}>
        {isRTL ? "✏️ المحتوى" : "✏️ Edit Copy"}
      </button>
    </div>
  );
}
