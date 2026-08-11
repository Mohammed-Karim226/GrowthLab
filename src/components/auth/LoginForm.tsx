"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { Loader2, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ApiRequestError, apiPost } from "@/lib/api-client";
import type { UserRole } from "@/types/database";

type LoginResponse = {
  redirectTo: string;
  role: UserRole;
  wrongArea: boolean;
};

type LoginFormProps = {
  /** Which door this form is. UX only — never a security boundary. */
  expectedRole: UserRole;
};

export default function LoginForm({ expectedRole }: LoginFormProps) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      apiPost<LoginResponse>("/api/auth/login", {
        ...credentials,
        expectedRole,
        locale,
      }),
    onSuccess: (data) => {
      // Full navigation so the refreshed auth cookie is picked up server-side.
      router.replace(data.redirectTo);
      router.refresh();
    },
    onError: (error) => {
      setErrorKey(error instanceof ApiRequestError ? error.errorKey : "serverError");
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorKey(null);

    const trimmed = email.trim();
    if (!trimmed || !password) {
      setErrorKey("invalidInput");
      return;
    }

    mutation.mutate({ email: trimmed, password });
  }

  // Stays true through the redirect so the button cannot be double-submitted.
  const busy = mutation.isPending || mutation.isSuccess;
  const premium = expectedRole === "client";

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor="email" className={premium ? "text-[#aaa69d]" : undefined}>
            {t("email")}
          </FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            dir="ltr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={errorKey ? true : undefined}
            disabled={busy}
            placeholder={t("emailPlaceholder")}
            className={premium ? "h-12 rounded-xl border-white/[0.08] bg-black/20 text-[#f0ede5] placeholder:text-[#5f5e58] focus-visible:ring-[#d8be78]/40" : undefined}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password" className={premium ? "text-[#aaa69d]" : undefined}>
            {t("password")}
          </FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            dir="ltr"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={premium ? "h-12 rounded-xl border-white/[0.08] bg-black/20 text-[#f0ede5] placeholder:text-[#5f5e58] focus-visible:ring-[#d8be78]/40" : undefined}
            aria-invalid={errorKey ? true : undefined}
            disabled={busy}
            placeholder="••••••••"
          />
        </Field>

        {errorKey && (
          <FieldError role="alert">{t(`errors.${errorKey}` as never)}</FieldError>
        )}

        <Button
          type="submit"
          disabled={busy}
          className={premium
            ? "portal-gold-button h-12 w-full rounded-full text-sm font-semibold text-[#17150f]"
            : "button-primary button-shine h-11 w-full rounded-full text-sm font-semibold text-white"}
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              {t("signingIn")}
            </>
          ) : (
            t("signIn")
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}

/** Shared chrome for both login screens, so the two doors stay consistent. */
export function LoginShell({
  title,
  subtitle,
  footnote,
  premium = false,
  children,
}: {
  title: string;
  subtitle: string;
  footnote?: string;
  premium?: boolean;
  children: React.ReactNode;
}) {
  const tPortal = useTranslations("portal.ui");

  if (premium) {
    return (
      <main className="portal-shell relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090a08] px-4 py-16">
        <div aria-hidden className="portal-ambient pointer-events-none absolute inset-0" />
        <div aria-hidden className="portal-noise pointer-events-none absolute inset-0 opacity-50" />
        <div aria-hidden className="portal-hero-grid pointer-events-none absolute inset-0 opacity-40" />
        <div aria-hidden className="pointer-events-none absolute -top-44 start-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-[#d8be78]/[0.07] blur-[120px]" />

        <div className="portal-reveal relative w-full max-w-[450px] overflow-hidden rounded-[30px] border border-white/[0.075] bg-[#0e0f0c]/90 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-9">
          <div aria-hidden className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-[#d8be78]/60 to-transparent" />
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="relative flex size-14 items-center justify-center rounded-[18px] border border-[#d8be78]/20 bg-[#d8be78]/[0.08] text-[#e0ca8a] shadow-[0_16px_44px_rgba(216,190,120,0.1)]">
              <Sparkles className="size-6" strokeWidth={1.7} aria-hidden />
              <span className="absolute -end-1 -bottom-1 flex size-5 items-center justify-center rounded-full border-2 border-[#0e0f0c] bg-[#54d8ac] text-[#0a1511]">
                <ShieldCheck className="size-3" strokeWidth={2.2} aria-hidden />
              </span>
            </div>
            <div>
              <p className="mb-2 text-[9px] font-semibold tracking-[0.24em] text-[#8d8060] uppercase">
                GrowthLab · {tPortal("privateAccess")}
              </p>
              <h1 className="font-satoshi text-3xl tracking-[-0.045em] text-[#f4f0e7]">{title}</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#85837b]">{subtitle}</p>
            </div>
          </div>

          <div className="mt-8">{children}</div>

          {footnote && (
            <p className="mt-6 flex items-center justify-center gap-1.5 border-t border-white/[0.055] pt-5 text-center text-[10px] text-[#6d6c65]">
              <LockKeyhole className="size-3 text-[#a89158]" aria-hidden />
              {footnote}
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070b1e] px-4 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 hero-grid opacity-60" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 start-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl"
      />

      <div className="liquid-card relative w-full max-w-md rounded-3xl p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
            <Image src="/images/strategy.png" alt="" width={28} height={28} />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-satoshi text-2xl text-white">{title}</h1>
            <p className="text-sm text-slate-400">{subtitle}</p>
          </div>
        </div>

        <div className="mt-8">{children}</div>

        {footnote && (
          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
            <LockKeyhole className="size-3" aria-hidden />
            {footnote}
          </p>
        )}
      </div>
    </main>
  );
}
