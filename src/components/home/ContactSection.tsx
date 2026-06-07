"use client";

import { Input } from "@base-ui/react/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Field, FieldDescription, FieldError, FieldLabel } from "../ui/field";

const formSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters."),
  lastName: z.string().min(2, "Last name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits.")
    .regex(/^[\d\s\-\+\(\)]+$/, "Please enter a valid phone number."),
});

type FormData = z.infer<typeof formSchema>;

const ANIMATION_CONFIG = {
  formEntrance: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] },
  },
  buttonHover: {
    scale: 1.02,
    transition: { type: "spring", stiffness: 400, damping: 15 },
  },
  inputFocus: {
    scale: 1.01,
    transition: { duration: 0.2 },
  },
  floatingElements: {
    duration: 12,
    repeat: Infinity,
    ease: "easeInOut",
  },
} as const;

const FloatingShapes = function FloatingShapes({
  prefersReducedMotion,
}: {
  prefersReducedMotion: boolean;
}) {
  if (prefersReducedMotion) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-32 top-20 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl"
        animate={{
          x: [0, 40, 0],
          y: [0, -30, 0],
        }}
        transition={{
          duration: ANIMATION_CONFIG.floatingElements.duration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute -bottom-40 right-10 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl"
        animate={{
          x: [0, -50, 0],
          y: [0, 40, 0],
        }}
        transition={{
          duration: ANIMATION_CONFIG.floatingElements.duration + 3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />
      <motion.div
        className="absolute left-1/3 top-1/2 h-60 w-60 rounded-full bg-sky-400/8 blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.4, 0.8, 0.4],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
};

export default function ContactSection() {
  const prefersReducedMotion = useReducedMotion();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    // Simulate API call (replace with real backend later)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    console.log("Form Submitted:", data);

    // Success Toast
    toast.success("Request Received Successfully!", {
      description: `We've sent a confirmation message to ${data.phone}`,
      duration: 5000,
    });

    setIsSuccess(true);
    form.reset({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
    });

    // Reset success state
    setTimeout(() => {
      setIsSuccess(false);
    }, 4500);

    setIsSubmitting(false);
  };

  return (
    <section
      id="contact"
      className="relative min-h-screen overflow-hidden bg-[#030614] py-24 sm:py-28 lg:py-36"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.05),transparent_45%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:48px_48px] opacity-[0.04]" />
      </div>

      <FloatingShapes prefersReducedMotion={prefersReducedMotion || false} />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={ANIMATION_CONFIG.formEntrance.initial}
          animate={ANIMATION_CONFIG.formEntrance.animate}
          transition={ANIMATION_CONFIG.formEntrance.transition}
          className="mx-auto max-w-3xl"
        >
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] shadow-[0_40px_100px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <div className="relative border-b border-white/10 bg-gradient-to-br from-cyan-400/5 to-blue-500/5 px-6 py-10 text-center sm:px-10 sm:py-12">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-2xl" />
              <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />

              <div className="relative">
                <div className="mx-auto mb-4 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
                    GET STARTED
                  </span>
                </div>

                <h2 className="font-satoshi text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Grow Your{" "}
                  <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 bg-clip-text text-transparent">
                    YouTube Channel
                  </span>
                </h2>

                <p className="mx-auto mt-4 max-w-md text-sm text-slate-400">
                  Fill in your details and we&apos;ll craft a personalized
                  outreach strategy for you.
                </p>
              </div>
            </div>

            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="p-6 sm:p-10"
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <Controller
                  name="firstName"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-400/80">
                        FIRST NAME
                      </FieldLabel>
                      <motion.div
                        animate={
                          fieldState.invalid
                            ? {}
                            : prefersReducedMotion
                              ? {}
                              : ANIMATION_CONFIG.inputFocus
                        }
                        className="relative"
                      >
                        <Input
                          {...field}
                          placeholder="FIRST NAME"
                          aria-invalid={fieldState.invalid}
                          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-white placeholder:text-slate-500/60 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
                        />
                      </motion.div>
                      {fieldState.invalid && (
                        <FieldError
                          errors={[fieldState.error]}
                          className="mt-1 text-xs text-red-400"
                        />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="lastName"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-400/80">
                        LAST NAME
                      </FieldLabel>
                      <motion.div
                        animate={
                          fieldState.invalid
                            ? {}
                            : prefersReducedMotion
                              ? {}
                              : ANIMATION_CONFIG.inputFocus
                        }
                        className="relative"
                      >
                        <Input
                          {...field}
                          placeholder="LAST NAME"
                          aria-invalid={fieldState.invalid}
                          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-white placeholder:text-slate-500/60 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
                        />
                      </motion.div>
                      {fieldState.invalid && (
                        <FieldError
                          errors={[fieldState.error]}
                          className="mt-1 text-xs text-red-400"
                        />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="email"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-400/80">
                        EMAIL ADDRESS
                      </FieldLabel>
                      <motion.div
                        animate={
                          fieldState.invalid
                            ? {}
                            : prefersReducedMotion
                              ? {}
                              : ANIMATION_CONFIG.inputFocus
                        }
                        className="relative"
                      >
                        <Input
                          {...field}
                          type="email"
                          placeholder="EMAIL ADDRESS"
                          aria-invalid={fieldState.invalid}
                          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-white placeholder:text-slate-500/60 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
                        />
                      </motion.div>
                      {fieldState.invalid && (
                        <FieldError
                          errors={[fieldState.error]}
                          className="mt-1 text-xs text-red-400"
                        />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="phone"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-400/80">
                        PHONE NUMBER
                      </FieldLabel>
                      <motion.div
                        animate={
                          fieldState.invalid
                            ? {}
                            : prefersReducedMotion
                              ? {}
                              : ANIMATION_CONFIG.inputFocus
                        }
                        className="relative"
                      >
                        <Input
                          {...field}
                          type="tel"
                          placeholder="PHONE NUMBER"
                          aria-invalid={fieldState.invalid}
                          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-white placeholder:text-slate-500/60 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
                        />
                      </motion.div>
                      <FieldDescription className="mt-1 text-xs text-slate-500">
                        We&apos;ll send you a confirmation SMS
                      </FieldDescription>
                      {fieldState.invalid && (
                        <FieldError
                          errors={[fieldState.error]}
                          className="mt-1 text-xs text-red-400"
                        />
                      )}
                    </Field>
                  )}
                />
              </div>

              <motion.button
                type="submit"
                disabled={isSubmitting}
                className="group relative mt-8 w-full overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 p-[1px] shadow-[0_8px_20px_rgba(6,182,212,0.3)] transition-all duration-300 hover:shadow-[0_12px_30px_rgba(6,182,212,0.4)] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                whileHover={
                  !isSubmitting && !prefersReducedMotion
                    ? ANIMATION_CONFIG.buttonHover
                    : undefined
                }
                whileTap={
                  !isSubmitting && !prefersReducedMotion
                    ? { scale: 0.98 }
                    : undefined
                }
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 opacity-0 transition duration-500 group-hover:opacity-100" />
                <div className="relative flex items-center justify-center gap-2 rounded-xl bg-[#030614] px-6 py-3.5 font-semibold text-white transition duration-300 group-hover:bg-transparent">
                  {isSubmitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <span>Sending...</span>
                    </>
                  ) : isSuccess ? (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      <span>Request Sent!</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Request</span>
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </>
                  )}
                </div>
              </motion.button>

              <p className="mt-6 text-center text-[11px] text-slate-500">
                By submitting, you agree to our{" "}
                <a
                  href="#"
                  className="text-cyan-400 transition hover:text-cyan-300"
                >
                  Terms
                </a>{" "}
                and{" "}
                <a
                  href="#"
                  className="text-cyan-400 transition hover:text-cyan-300"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </form>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-6 text-center text-xs text-slate-500"
          >
            <span className="flex items-center gap-1.5">
              <svg
                className="h-3.5 w-3.5 text-cyan-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <svg
                className="h-3.5 w-3.5 text-cyan-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Free personalized strategy
            </span>
            <span className="flex items-center gap-1.5">
              <svg
                className="h-3.5 w-3.5 text-cyan-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Cancel anytime
            </span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
