"use client";

export default function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs bg-muted text-muted-foreground">
      <span className="text-muted-foreground/70">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
