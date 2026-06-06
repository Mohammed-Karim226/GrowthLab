"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { useState } from "react";
import { motion } from "framer-motion";
import { Send, CheckCircle, Phone, User, Mail } from "lucide-react";
import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../ui/card";
import { Field, FieldLabel, FieldError, FieldDescription } from "../ui/field";

const formSchema = z.object({
  fullName: z.string().min(3, "Full name must be at least 3 characters."),
  email: z.string().email("Please enter a valid email address."),
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits.")
    .regex(/^[\d\s\-\+\(\)]+$/, "Please enter a valid phone number."),
});

type FormData = z.infer<typeof formSchema>;

export default function ContactSection() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
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
    form.reset();

    // Reset success state
    setTimeout(() => {
      setIsSuccess(false);
    }, 4500);

    setIsSubmitting(false);
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <Card className="border-white/10 bg-gradient-to-br from-[#0D1235] to-[#0A0E27] shadow-2xl overflow-hidden">
          <CardHeader className="text-center pb-8 pt-10">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0891B2] to-[#22D3EE]">
              <Send className="h-8 w-8 text-black" />
            </div>
            <CardTitle className="text-3xl font-bold text-white tracking-tight">
              Let&apos;s Connect
            </CardTitle>
            <CardDescription className="text-slate-400 mt-3 text-base">
              Tell us about your goals. We reply fast.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-7">
              {/* Full Name */}
              <Controller
                name="fullName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel className="flex items-center gap-2">
                      <User className="h-4 w-4" /> Full Name
                    </FieldLabel>
                    <Input
                      {...field}
                      placeholder="Alex Rivera"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              {/* Email */}
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel className="flex items-center gap-2">
                      <Mail className="h-4 w-4" /> Email Address
                    </FieldLabel>
                    <Input
                      {...field}
                      type="email"
                      placeholder="you@example.com"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              {/* Phone Number */}
              <Controller
                name="phone"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel className="flex items-center gap-2">
                      <Phone className="h-4 w-4" /> Phone Number
                    </FieldLabel>
                    <Input
                      {...field}
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldDescription>
                      We&apos;ll send you a confirmation SMS
                    </FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </form>
          </CardContent>

          <CardFooter className="px-8 pb-10">
            <Button
              type="button"
              onClick={form.handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-[#0891B2] to-[#22D3EE] hover:brightness-110 transition-all active:scale-[0.985]"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⟳</span> Sending...
                </span>
              ) : isSuccess ? (
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-6 w-6" /> Request Sent!
                </span>
              ) : (
                "Send Message & Get Confirmation"
              )}
            </Button>
          </CardFooter>
        </Card>
      </motion.div>

      {/* Trust Note */}
      <p className="text-center text-xs text-slate-500 mt-6">
        We respect your privacy. You&apos;ll receive a confirmation SMS shortly.
      </p>
    </div>
  );
}