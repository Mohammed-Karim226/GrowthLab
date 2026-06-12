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
        className="block text-xs font-semibold mb-1.5"
        style={{ color: "#a0aec0" }}
      >
        {label}
      </label>
      <textarea
        value={value}
        onChange={onChange}
        rows={rows}
        className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all resize-y"
        style={{
          background: "#0f1923",
          color: "#e2e8f0",
          border: "1px solid #2d3d52",
          fontFamily: "Manrope, sans-serif",
          lineHeight: "1.6",
          minHeight: `${rows * 24}px`,
        }}
      />
    </div>
  );
}
