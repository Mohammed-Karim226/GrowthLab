"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle, Shield, Clock, Users, Star, Zap, TrendingUp, Youtube, Instagram, Music, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Input } from "@base-ui/react/input";
import { Field, FieldDescription, FieldError, FieldLabel } from "../ui/field";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters."),
  lastName: z.string().min(2, "Last name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  channelName: z.string().min(2, "Channel name must be at least 2 characters."),
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits.")
    .regex(/^[\d\s\-\+\(\)]+$/, "Please enter a valid phone number."),
});

type FormData = z.infer<typeof formSchema>;

export default function ContactSection() {
  const prefersReducedMotion = useReducedMotion();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const locale = useLocale();
  const isAr = locale === "ar";
  const t = useTranslations("contact");
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { firstName: "", lastName: "", email: "", channelName: "" , phone: ""},
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1450));

    console.log("Form Submitted:", data);

    toast.success("🎉 Request Received Successfully!", {
      description: `Confirmation SMS sent to ${data.phone}`,
      duration: 6500,
    });

    setIsSuccess(true);
    form.reset();
    setTimeout(() => setIsSuccess(false), 4800);
    setIsSubmitting(false);
  };

  return (
    <section id="contact" className="relative pt-2 pb-10 overflow-hidden bg-[#030614]">
      <div className="absolute inset-0 bg-[radial-gradient(#0891B2_0.7px,transparent_1px)] background-size:[60px_60px] opacity-40" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="space-y-12"
          >
            <div className = "max-sm:flex max-sm:flex-col max-sm:items-center max-sm:justify-center">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-3xl bg-linear-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-400/30 mb-8">
                <Zap className="h-6 w-6 text-cyan-400 animate-pulse" />
                <span className="text-sm font-mono tracking-[3px] text-cyan-300 font-semibold">{t("badge")}</span>
              </div>

              <h2 className="text-5xl max-sm:text-4xl max-sm:text-center font-bold tracking-tighter leading-12 max-sm:leading-16">
              {t("titleLine1")}{" "}
                <span className="bg-linear-to-r from-[#67E8F9] via-[#C084FC] to-[#F472B6] bg-clip-text text-transparent animate-gradient">
                  {t("titleHighlight")}
                </span>{" "}
              </h2>
            </div>

            <div className="space-y-8">
              {[
                { icon: TrendingUp, title: "Proven Growth Tactics", desc: "Strategies used by top creators in 2026" },
                { icon: Users, title: "1,200+ Success Stories", desc: "Real creators making real money" },
                { icon: Clock, title: "Response in &lt; 2 Hours", desc: "Dedicated strategy team" },
                { icon: Shield, title: "100% Private & Secure", desc: "Your data is protected" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="flex gap-6 group"
                >
                  <div className="h-12 w-12 rounded-2xl bg-linear-to-br from-cyan-400/10 to-violet-400/10 flex items-center justify-center group-hover:rotate-12 transition-transform">
                    <item.icon className="h-7 w-7 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-white">{t(`features.${i}.title`)}</p>
                    <p className="text-slate-400 mt-1.5">{t(`features.${i}.desc`)}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex items-center gap-4 pt-8 border-t border-white/10">
              <div className="flex -space-x-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 w-10 rounded-full border-2 border-[#030614] overflow-hidden ring-2 ring-cyan-400/30">
                    <img src={`https://randomuser.me/api/portraits/men/${i + 15}.jpg`} alt="Creator" />
                  </div>
                ))}
              </div>
              <div className="relative text-sm leading-tight text-slate-400">
                <p className="text-sm text-slate-400 leading-tight">{t("trustedBy")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white shadow-[0_0_15px_rgba(248,113,113,0.18)]">
                    <Youtube className="h-4 w-4 text-red-400" />
                    YouTube
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white shadow-[0_0_15px_rgba(148,163,184,0.2)]">
                    <Music className="h-4 w-4 text-slate-200" />
                    TikTok
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white shadow-[0_0_15px_rgba(244,114,182,0.2)]">
                    <Instagram className="h-4 w-4 text-pink-300" />
                    Instagram
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2 }}
          >
            <div className="relative rounded-3xl border border-white/10 bg-[#0A0E27] p-10 lg:p-12 shadow-2xl backdrop-blur-3xl">
              <div className="absolute -inset-px bg-linear-to-br from-cyan-400/20 via-violet-400/10 to-transparent rounded-3xl -z-10" />

              <h3 className="text-3xl max-sm:text-2xl font-bold text-white mb-10">{t("formTitle")}</h3>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <FieldLabel className="text-xs font-mono tracking-widest text-cyan-400 mb-2">{t("firstNameLabel")}</FieldLabel>
                    <Controller
                      name="firstName"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <Input
                            {...field}
                            placeholder={isAr ? "أحمد" : "John"}
                            className={cn("h-14 bg-white/5 border border-white/10 focus:border-cyan-400 rounded-lg text-base placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-400/30 transition-all",
                              isAr ? "placeholder:pr-4" : "placeholder:pl-4"
                            )}
                          />
                          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                    />
                  </div>

                  <div>
                    <FieldLabel className="text-xs font-mono tracking-widest text-cyan-400 mb-2">{t("lastNameLabel")}</FieldLabel>
                    <Controller
                      name="lastName"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <Input
                            {...field}
                            placeholder={isAr ? "العمري" : "Rivera"}
 className={cn("h-14 bg-white/5 border border-white/10 focus:border-cyan-400 rounded-lg text-base placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-400/30 transition-all",
                              isAr ? "placeholder:pr-4" : "placeholder:pl-4"
                            )}                          />
                          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel className="text-xs font-mono tracking-widest text-cyan-400 mb-2">{t("emailLabel")}</FieldLabel>
                  <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <Input
                          {...field}
                          type="email"
                          placeholder={isAr ? "you@creator.com" : "you@creator.com"}
                          className={cn("h-14 bg-white/5 border border-white/10 focus:border-cyan-400 rounded-lg text-base placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-400/30 transition-all",
                            isAr ? "placeholder:pr-4" : "placeholder:pl-4"
                          )}
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                </div>
 <div>
                    <FieldLabel className="text-xs font-mono tracking-widest text-cyan-400 mb-2">{t("channelNameLabel")}</FieldLabel>
                    <Controller
                      name="channelName"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <Input
                            {...field}
                            placeholder={isAr ? "اسم القناة" : "Channel Name"}
                            className={cn("h-14 bg-white/5 border border-white/10 focus:border-cyan-400 rounded-lg text-base placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-400/30 transition-all",
                              isAr ? "placeholder:pr-4" : "placeholder:pl-4"
                            )}
                          />
                          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                    />
                  </div>
                <div>
                  <FieldLabel className="text-xs font-mono tracking-widest text-cyan-400 mb-2">{t("phoneLabel")}</FieldLabel>
                  <Controller
                    name="phone"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <Input
                          {...field}
                          type="tel"
                          placeholder={isAr ? "+966 50 123 4567" : "+1 (555) 123-4567"}
                          className={cn("h-14 bg-white/5 border border-white/10 focus:border-cyan-400 rounded-lg text-base placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-400/30 transition-all",
                            isAr ? "placeholder:pr-4 text-right" : "placeholder:pl-4"
                          )}
                        />
                        <FieldDescription className="text-emerald-400 text-xs mt-2 flex items-center gap-2">
                          <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                          {t("smsConfirmation")}
                        </FieldDescription>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="cursor-pointer relative mt-6 w-full h-16 max-sm:h-12 rounded-2xl overflow-hidden group font-semibold text-lg shadow-2xl shadow-cyan-500/40 bg-gradient-to-r from-[#67E8F9] via-[#C084FC] to-[#F472B6]"
                >
                  <div className="absolute inset-0 bg-white/30 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                  <div className="relative flex items-center justify-center gap-3 text-black font-bold max-sm:text-base">
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin h-5 w-5 border-2 border-black/30 border-t-black rounded-full" />
                        {t("processing")}
                      </>
                    ) : isSuccess ? (
                      <>
                        <CheckCircle className="h-7 w-7" />
                        {t("successMessage")}
                      </>
                    ) : (
                      <>
                        {t("submitButton")}
                        {isAr ? <ArrowLeft className="group-hover:translate-x-2 transition-transform max-sm:size-6" /> : <ArrowRight className="group-hover:translate-x-2 transition-transform max-sm:size-6" />}
                      </>
                    )}
                  </div>
                </motion.button>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}