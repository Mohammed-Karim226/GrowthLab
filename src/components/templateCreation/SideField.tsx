"use client";

export default function SideField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        className="block text-xs font-semibold mb-1.5"
        style={{ color: "#a0aec0" }}
      >
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all"
        style={{
          background: "#0f1923",
          color: "#e2e8f0",
          border: "1px solid #2d3d52",
          fontFamily: "Manrope, sans-serif",
        }}
      />
    </div>
  );
}
