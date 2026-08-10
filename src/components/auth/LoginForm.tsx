"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { Loader2, LockKeyhole } from "lucide-react";
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

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
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
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            dir="ltr"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
          className="button-primary button-shine h-11 w-full rounded-full text-sm font-semibold text-white"
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
  children,
}: {
  title: string;
  subtitle: string;
  footnote?: string;
  children: React.ReactNode;
}) {
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
