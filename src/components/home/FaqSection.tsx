"use client";

import { motion, AnimatePresence } from "framer-motion";
import SectionReveal from "@/components/home/SectionReveal";
import type { FaqItem } from "@/lib/landing";
import { HelpCircle, Sparkles } from "lucide-react";
import { useState } from "react";

type FaqSectionProps = {
  faqs: FaqItem[];
};

export default function FaqSection({ faqs }: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      className="relative py-6 overflow-hidden bg-[#05070F]"
    >
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(#0891B2_0.6px,transparent_1px)] [background-size:40px_40px] opacity-40" />
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-[#0891B2] rounded-full blur-[120px] opacity-20" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[#22D3EE] rounded-full blur-[140px] opacity-20" />
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 relative z-10">
        <SectionReveal>
          <div className="text-center mb-20">
            <div className="mx-auto mb-6 flex justify-center">
              <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full border border-[#0891B2]/30 bg-[#0891B2]/5">
                <Sparkles className="h-5 w-5 text-[#0891B2]" />
                <span className="text-[#0891B2] text-xs font-mono tracking-[3px] font-semibold">
                  KNOWLEDGE BASE
                </span>
              </div>
            </div>

            <h2 className="font-satoshi text-5xl max-sm:text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tighter text-white mb-6">
              Everything you wanted to know,
              <br />
              <span className="bg-gradient-to-r from-white via-[#0891B2] to-[#22D3EE] bg-clip-text text-transparent">
                answered instantly
              </span>
            </h2>

            <p className="text-xl max-sm:text-lg text-slate-400 max-w-2xl mx-auto">
              No corporate fluff. Just real answers from creators who’ve been
              exactly where you are.
            </p>
          </div>
        </SectionReveal>

        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.07 }}
                className="relative"
              >
                <div
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className={`group cursor-pointer rounded-3xl border transition-all duration-500 overflow-hidden
                    ${
                      isOpen
                        ? "border-[#0891B2] shadow-2xl shadow-[#0891B2]/20 bg-gradient-to-br from-[#0D1235] to-[#0A0E27]"
                        : "border-white/10 hover:border-white/30 bg-[#0A0E27]"
                    }`}
                >
                  {/* Question */}
                  <div className="px-8 py-7 flex items-center gap-6">
                    <div
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-mono transition-all
                      ${isOpen ? "bg-[#0891B2] text-black" : "bg-white/5 text-slate-400 group-hover:bg-white/10"}`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <h3 className="flex-1 text-[17px] font-medium text-white leading-tight pr-8">
                      {faq.q}
                    </h3>

                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.4 }}
                      className="text-[#0891B2]"
                    >
                      ↓
                    </motion.div>
                  </div>

                  {/* Answer with smooth animation */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-8 pb-10">
                          <div className="pl-14 border-l-2 border-[#0891B2]/50 text-slate-200 leading-relaxed text-[15.5px]">
                            {faq.a}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>

        <SectionReveal delay={0.4}>
          <div className="mt-20 text-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="group inline-flex items-center gap-4 px-10 py-5 rounded-3xl bg-gradient-to-r from-white/5 to-white/10 border border-white/10 hover:border-[#0891B2]/50 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:shadow-[#0891B2]/20 transition-all duration-500"
            >
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  repeatType: "reverse",
                }}
              >
                <HelpCircle className="w-6 h-6 text-[#0891B2]" />
              </motion.div>

              <a
                href="#contact"
                className="text-lg font-semibold text-white group-hover:text-[#0891B2] transition-colors flex items-center gap-3"
              >
                Still have questions?
                <span className="text-[#0891B2] group-hover:translate-x-2 transition-transform duration-300">
                  →
                </span>
              </a>

              <motion.div
                animate={{ x: [0, 6, 0] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              >
                <Sparkles className="w-5 h-5 text-[#22D3EE]" />
              </motion.div>
            </motion.div>

            <p className="mt-5 text-sm text-slate-500 font-mono tracking-wide">
              Average reply time •{" "}
              <span className="text-emerald-400">Under 2 hours</span>
            </p>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
