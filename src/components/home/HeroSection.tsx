import { ArrowRight, ChevronDown, Play, Sparkles, Star } from "lucide-react";
import AnalyticsDashboard from "@/components/home/AnalyticsDashboard";
import Image from "next/image";
import { motion } from "framer-motion";

export default function HeroSection() {
  return (
    <section className="relative min-h-[calc(100vh-5rem)] overflow-hidden pt-20 pb-12">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-0 top-24 h-96 w-96 rounded-full bg-[radial-gradient(circle,_#0891B2,_transparent)] opacity-20 blur-3xl" />
        <div className="absolute right-0 top-32 h-80 w-80 rounded-full bg-[radial-gradient(circle,_#3B82F6,_transparent)] opacity-15 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_#F59E0B,_transparent)] opacity-10 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div className="relative z-10 flex flex-col justify-center gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.9 }}
            className="inline-flex items-center gap-2 rounded-full border border-[#0891B2]/30 bg-[#0891B2]/10 px-4 py-1.5 text-xs font-medium text-[#0891B2]"
          >
            <Sparkles className="h-4 w-4" />
            1,000+ Creators Scaled to New Heights
          </motion.div>

          <motion.h1
            initial={{scale: 0.95 }}
            animate={{scale: 1 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="font-satoshi text-4xl leading-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl"
          >
            Your Channel
            <br />
            <span className="gradient-text-teal">Deserves Strategic</span>
            <br />
            Growth
          </motion.h1>

          <motion.p 
           initial={{scale: 0.90 }}
            animate={{scale: 1 }}
            transition={{ delay: 0.4, duration: 0.9 }}
          className="max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
            Stop guessing. Start scaling. We engineer attention-grabbing,
            data-driven growth strategies across YouTube and other social media
            channels that compound month over month — turning your content into
            a powerful distribution engine.
          </motion.p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <motion.a
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, duration: 0.9 }}
              href="#contact"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0891B2] to-[#0671A1] px-7 py-3.5 text-sm font-semibold text-white transition hover:opacity-95"
            >
              Book Free Strategy Call
              <ArrowRight className="h-4 w-4" />
            </motion.a>
            <motion.a
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, duration: 0.9 }}
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-7 py-3.5 text-sm font-medium text-white transition hover:border-white/30"
            >
              <Play className="h-4 w-4" />
              See How It Works
            </motion.a>
          </div>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex space-x-1">
              {[1, 2, 3, 4].map((index) => (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  key={index}
                >
                  <Image
                    key={index}
                    src="/images/creator.png"
                    alt="Profile placeholder"
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full border-2 border-[#0A0E27] object-cover"
                  />
                </motion.div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, idx) => (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 + 0.5 }}
                    key={idx}
                  >
                    <Star
                      key={idx}
                      className="h-3.5 w-3.5 text-[#F59E0B]"
                      fill="currentColor"
                      stroke="currentColor"
                    />
                  </motion.div>
                ))}
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="text-xs text-slate-400"
              >
                Trusted by <span className="text-white">1,000+</span> creators
              </motion.p>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <AnalyticsDashboard />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-8 flex justify-center text-slate-600">
        <ChevronDown className="h-6 w-6" />
      </div>
    </section>
  );
}
