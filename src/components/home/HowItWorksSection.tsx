"use client";

import { motion, useReducedMotion } from "framer-motion";
import { memo } from "react";
import SectionReveal from "@/components/home/SectionReveal";
import type { StepCard } from "@/lib/landing";

type HowItWorksSectionProps = {
  steps: StepCard[];
};

type FlowNode = {
  wrapper: string;
  width: string;
  driftY: number[];
  rotate: number[];
  curve: string;
};

// ============= ANIMATION CONSTANTS =============
const ANIMATION_CONFIG = {
  cardEntrance: {
    initial: { opacity: 0, scale: 0.96, y: 24 },
    whileInView: { opacity: 1, scale: 1, y: 0 },
    viewport: { once: false, amount: 0.2 },
  },
  cardFloat: { duration: 8 },
  cardOpacity: { duration: 0.8, ease: "easeInOut" },
  coreRotate: { duration: 34 },
  corePulse: { duration: 7.5 },
  pathAnimation: { duration: 4.2, perIndexDelay: 0.45 },
  revealDelay: 0.1,
} as const;

// ============= FLOW NODES CONFIGURATION =============
const FLOW_NODES: FlowNode[] = [
  {
    wrapper: "left-[7%] top-[8%] xl:left-[10%]",
    width: "w-[310px]",
    driftY: [0, -8, 0],
    rotate: [-1, 1, -1],
    curve: "M 500 440 C 410 350, 315 255, 230 160",
  },
  {
    wrapper: "right-[5%] top-[22%] xl:right-[8%]",
    width: "w-[330px]",
    driftY: [0, 9, 0],
    rotate: [1, -1, 1],
    curve: "M 500 440 C 610 365, 710 280, 800 235",
  },
  {
    wrapper: "left-[9%] bottom-[20%] xl:left-[12%]",
    width: "w-[300px]",
    driftY: [0, -9, 0],
    rotate: [1, -1, 1],
    curve: "M 500 440 C 395 520, 305 610, 230 700",
  },
  {
    wrapper: "right-[7%] bottom-[8%] xl:right-[10%]",
    width: "w-[320px]",
    driftY: [0, 8, 0],
    rotate: [-1, 1, -1],
    curve: "M 500 440 C 615 520, 710 615, 790 735",
  },
];

const CAPSULE_RADIUS = [
  "rounded-[32px_32px_24px_32px]",
  "rounded-[28px_36px_28px_28px]",
  "rounded-[36px_26px_32px_26px]",
  "rounded-[28px_28px_36px_24px]",
];

// ============= FLOW CONNECTOR PATHS COMPONENT =============
const FlowConnectors = memo(function FlowConnectors({
  nodeCount,
  prefersReducedMotion,
}: {
  nodeCount: number;
  prefersReducedMotion: boolean;
}) {
  const visibleNodes = FLOW_NODES.slice(0, nodeCount);

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      viewBox="0 0 1000 940"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="flow-connector" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(34,211,238,0.04)" />
          <stop offset="50%" stopColor="rgba(34,211,238,0.34)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0.06)" />
        </linearGradient>
        <filter id="flow-soft-glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {visibleNodes.map((node, index) => (
        <g key={`flow-${index}`}>
          <path
            d={node.curve}
            stroke="rgba(255,255,255,0.035)"
            strokeWidth="1"
            fill="none"
          />
          <path
            d={node.curve}
            stroke="url(#flow-connector)"
            strokeWidth="1.4"
            fill="none"
            filter="url(#flow-soft-glow)"
            strokeDasharray="7 10"
            opacity="0.9"
          />
          {!prefersReducedMotion && (
            <motion.circle
              r="3"
              fill="#67e8f9"
              filter="url(#flow-soft-glow)"
              animate={{ offsetDistance: ["0%", "100%"] }}
              transition={{
                duration:
                  ANIMATION_CONFIG.pathAnimation.duration +
                  index * ANIMATION_CONFIG.pathAnimation.perIndexDelay,
                repeat: Infinity,
                ease: "linear",
                delay: index * 0.35,
              }}
              style={{
                offsetPath: `path('${node.curve}')`,
              }}
            />
          )}
        </g>
      ))}
    </svg>
  );
});

// ============= CENTRAL CORE COMPONENT =============
const GrowthCore = memo(function GrowthCore({
  prefersReducedMotion,
}: {
  prefersReducedMotion: boolean;
}) {
  return (
    <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
      {!prefersReducedMotion && (
        <motion.div
          className="absolute left-1/2 top-1/2 h-[250px] w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/10"
          animate={{ rotate: 360 }}
          transition={{
            duration: ANIMATION_CONFIG.coreRotate.duration,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
          <div className="absolute bottom-0 left-1/2 h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.8)]" />
        </motion.div>
      )}

      <div className="absolute left-1/2 top-1/2 h-[340px] w-[120px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/8 blur-3xl" />

      <motion.div
        className="relative flex h-[176px] w-[176px] items-center justify-center rounded-[42px] border border-cyan-400/18 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.18),rgba(4,8,22,0.95)_68%)] shadow-[0_0_100px_rgba(6,182,212,0.14)] backdrop-blur-xl"
        animate={
          prefersReducedMotion
            ? undefined
            : {
                scale: [1, 1.025, 1],
                rotate: [0, 1.5, 0, -1.5, 0],
              }
        }
        transition={{
          duration: ANIMATION_CONFIG.corePulse.duration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <div className="absolute inset-3 rounded-[34px] border border-white/10" />
        <div className="absolute inset-0 rounded-[42px] bg-[conic-gradient(from_180deg,rgba(34,211,238,0.08),rgba(59,130,246,0.025),rgba(34,211,238,0.08))]" />
        {!prefersReducedMotion && (
          <motion.div
            className="absolute h-[78px] w-[78px] rounded-full bg-cyan-400/10 blur-xl"
            animate={{ scale: [1, 1.16, 1] }}
            transition={{
              duration: 3.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}

        <div className="relative z-10 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-300 shadow-[0_0_22px_rgba(34,211,238,0.14)]">
            <span className="text-lg font-bold">◎</span>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-300/90">
            Growth Core
          </p>
        </div>
      </motion.div>
    </div>
  );
});

// ============= STEP CARD COMPONENT =============
const StepCardComponent = memo(function StepCard({
  step,
  index,
  node,
  radius,
  prefersReducedMotion,
}: {
  step: StepCard;
  index: number;
  node: FlowNode;
  radius: string;
  prefersReducedMotion: boolean;
}) {
  return (
    <SectionReveal delay={index * ANIMATION_CONFIG.revealDelay}>
      <motion.article
        className={`absolute z-20 ${node.width} ${node.wrapper}`}
        initial={ANIMATION_CONFIG.cardEntrance.initial}
        whileInView={ANIMATION_CONFIG.cardEntrance.whileInView}
        viewport={ANIMATION_CONFIG.cardEntrance.viewport}
        animate={
          prefersReducedMotion
            ? undefined
            : {
                y: node.driftY,
                rotate: node.rotate,
              }
        }
        transition={{
          opacity: ANIMATION_CONFIG.cardOpacity,
          scale: {
            duration: ANIMATION_CONFIG.cardFloat.duration + index,
            repeat: Infinity,
            ease: "easeInOut",
          },
          y: {
            duration: ANIMATION_CONFIG.cardFloat.duration + index,
            repeat: Infinity,
            ease: "easeInOut",
          },
        }}
      >
        <div
          className={`absolute -inset-2 ${radius} bg-linear-to-br from-cyan-400/6 via-transparent to-blue-500/6 blur-xl`}
        />

        <motion.div
          whileHover={
            prefersReducedMotion
              ? undefined
              : { y: -6, scale: 1.018, rotate: 0 }
          }
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
          className={`group relative overflow-hidden border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_100px_rgba(0,0,0,0.38)] backdrop-blur-2xl ${radius}`}
        >
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.055),transparent_36%,transparent_70%,rgba(255,255,255,0.02))]" />

          <div className="absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100">
            <div className="absolute -left-8 top-0 h-32 w-32 rounded-full bg-cyan-400/8 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-32 w-32 rounded-full bg-blue-500/8 blur-3xl" />
          </div>

          <div className="absolute right-4 top-4 h-9 w-9 rounded-2xl border border-white/8 bg-white/[0.025]" />
          <div className="absolute right-5 top-3 text-[48px] font-black leading-none text-white/[0.04]">
            {step.num}
          </div>

          <div className="relative z-10">
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 to-blue-500/10 text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.08)]">
                <div className="[&_svg]:h-6 [&_svg]:w-6">{step.icon}</div>
              </div>

              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.34em] text-cyan-400">
                  Step {step.num}
                </p>
                <h3 className="text-lg font-semibold tracking-tight text-white">
                  {step.title}
                </h3>
              </div>
            </div>

            <div className="mb-4 h-px w-full bg-linear-to-r from-cyan-400/35 via-white/10 to-transparent" />

            <p className="text-sm leading-7 text-slate-400">{step.desc}</p>
          </div>
        </motion.div>
      </motion.article>
    </SectionReveal>
  );
});

// ============= MAIN COMPONENT =============
export default function HowItWorksSection({ steps }: HowItWorksSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const visibleSteps = steps.slice(0, 4);

  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden bg-[#030614] py-24 sm:py-28 lg:py-36"
    >
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[8%] h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-cyan-500/8 blur-3xl" />
        <div className="absolute left-[8%] top-[18%] h-[240px] w-[240px] rounded-full bg-sky-500/8 blur-3xl" />
        <div className="absolute right-[8%] bottom-[16%] h-[280px] w-[280px] rounded-full bg-blue-600/8 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.07),transparent_38%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.014)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.014)_1px,transparent_1px)] bg-[size:54px_54px] opacity-[0.05]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionReveal>
          <div className="mx-auto mb-14 w-full text-center lg:mb-20">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.38em] text-cyan-400">
              The Process
            </p>

            <h2 className="font-satoshi text-3xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              How We{" "}
              <span className="bg-linear-to-r from-cyan-300 via-sky-400 to-blue-500 bg-clip-text text-transparent">
                Convert Content into Organic Distribution
              </span>
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              Four connected phases, designed to strengthen each other — more
              like a responsive engine than a static checklist.
            </p>
          </div>
        </SectionReveal>

        {/* Desktop */}
        <div className="relative hidden min-h-[940px] lg:block">
          <FlowConnectors
            nodeCount={visibleSteps.length}
            prefersReducedMotion={prefersReducedMotion!}
          />

          <GrowthCore prefersReducedMotion={prefersReducedMotion!} />

          {/* Step Cards */}
          {visibleSteps.map((step, index) => {
            const node = FLOW_NODES[index];
            const radius = CAPSULE_RADIUS[index % CAPSULE_RADIUS.length];

            return (
              <StepCardComponent
                key={`${step.title}-${step.num}-${index}`}
                step={step}
                index={index}
                node={node}
                radius={radius}
                prefersReducedMotion={prefersReducedMotion!}
              />
            );
          })}
        </div>

        {/* Mobile */}
        <div className="grid gap-5 lg:hidden">
          {visibleSteps.map((step, index) => (
            <SectionReveal
              key={`mobile-${step.title}-${step.num}-${index}`}
              delay={index * 0.08}
            >
              <motion.article
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                whileHover={prefersReducedMotion ? undefined : { y: -3 }}
                className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-xl"
              >
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),transparent_35%,transparent_70%,rgba(255,255,255,0.02))]" />

                <div className="relative z-10 flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 to-blue-500/10 text-cyan-300">
                    <div className="[&_svg]:h-6 [&_svg]:w-6">{step.icon}</div>
                  </div>

                  <div className="min-w-0">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-cyan-400">
                      Step {step.num}
                    </p>
                    <h3 className="text-lg font-semibold text-white">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-400">
                      {step.desc}
                    </p>
                  </div>
                </div>
              </motion.article>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}