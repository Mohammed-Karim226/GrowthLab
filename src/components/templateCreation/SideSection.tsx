"use client";

export default function SideSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden bg-sidebar-accent border border-sidebar-border">
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b border-sidebar-border bg-sidebar"
      >
        <span className="text-sm">{icon}</span>
        <span
          className="text-xs font-bold tracking-wide text-muted-foreground"
        >
          {title.toUpperCase()}
        </span>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}
