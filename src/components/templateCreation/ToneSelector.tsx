"use client";

import { ChevronDown } from "lucide-react";
import type { Tone, Lang } from "@/lib/landing";

interface ToneSelectorProps {
  tone: Tone;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  lang: Lang;
}

export default function ToneSelector({ tone, onChange, lang }: ToneSelectorProps) {
  const isRTL = lang === "ar";
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "#a0aec0" }}>
        {isRTL ? "اختر النبرة" : "Select Tone"}
      </label>
      <div className="relative">
        <select
          value={tone}
          onChange={onChange}
          className="w-full appearance-none rounded-lg px-3 py-2.5 text-sm font-medium pr-8 focus:outline-none focus:ring-2"
          style={{ background: "#1a2535", color: "#e2e8f0", border: "1px solid #4a5568", fontFamily: "Manrope, sans-serif" }}>
          <option value="professional">{isRTL ? "احترافي" : "Professional"}</option>
          <option value="friendly">{isRTL ? "ودّي" : "Friendly"}</option>
        </select>
        <ChevronDown size={14} className="absolute top-1/2 -translate-y-1/2 pointer-events-none" style={{ [isRTL ? "left" : "right"]: "10px", color: "#718096" }} />
      </div>
      <div className="mt-2 rounded-lg p-3 text-xs leading-relaxed" style={{ background: "#1a2535", color: "#a0aec0" }}>
        {tone === "professional"
          ? (isRTL ? "✦ نبرة رسمية ومهنية مناسبة للعلامات التجارية الكبيرة والمؤسسات." : "✦ Formal, corporate tone — ideal for established brands & enterprises.")
          : (isRTL ? "✦ نبرة دافئة وعفوية مناسبة للعلامات التجارية الناشئة والمبدعة." : "✦ Warm, casual tone — ideal for startups & creative brands.")
        }
      </div>
    </div>
  );
}
