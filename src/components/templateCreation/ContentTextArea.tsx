"use client";

export default function ContentTextArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
}) {
  return (
    <div>
      <label
        className="block text-xs font-semibold mb-1.5 text-muted-foreground"
      >
        {label}
      </label>
      <textarea
        value={value}
        onChange={onChange}
        rows={rows}
        className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar-ring transition-all resize-y bg-input text-foreground border border-border leading-relaxed"
        style={{
          minHeight: `${rows * 24}px`,
        }}
      />
    </div>
  );
}
