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
    <div className="rounded-xl overflow-hidden" style={{ background: "#1a2535" }}>
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b"
        style={{ background: "#243044", borderColor: "#2d3d52" }}
      >
        <span className="text-sm">{icon}</span>
        <span
          className="text-xs font-bold tracking-wide font-sora"
          style={{ color: "#a0aec0" }}
        >
          {title.toUpperCase()}
        </span>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}
