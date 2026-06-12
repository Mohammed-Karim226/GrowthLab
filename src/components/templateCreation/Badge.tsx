"use client";

export default function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs"
      style={{ background: "#e2e8f0", color: "#4a5568" }}
    >
      <span style={{ color: "#718096" }}>{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
