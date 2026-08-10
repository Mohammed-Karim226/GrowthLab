"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, apiPost } from "@/lib/api-client";
import { createClientSchema } from "@/lib/validation/schemas";
import type { ClientRow } from "@/types/database";

type CreateResponse = {
  client: ClientRow;
  credentials: { email: string; password: string };
};

/** Cryptographically random suggestion, so admins don't invent weak passwords. */
function suggestPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export default function CreateClientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const t = useTranslations("admin.clients");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("admin.errors");

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  // Held in memory only, and only until the admin dismisses the panel (plan §28).
  const [credentials, setCredentials] = useState<CreateResponse["credentials"] | null>(null);

  function reset() {
    setName("");
    setCompanyName("");
    setEmail("");
    setPassword("");
    setNotes("");
    setErrorKey(null);
    setFieldErrors([]);
  }

  const mutation = useMutation({
    mutationFn: (input: Record<string, string>) =>
      apiPost<CreateResponse>("/api/admin/clients", input),
    onSuccess: (data) => {
      setCredentials(data.credentials);
      reset();
      onCreated();
    },
    onError: (error) => {
      if (error instanceof ApiRequestError) {
        setErrorKey(error.errorKey);
        setFieldErrors(error.details ?? []);
      } else {
        setErrorKey("serverError");
      }
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorKey(null);
    setFieldErrors([]);

    const payload = {
      name: name.trim(),
      companyName: companyName.trim(),
      email: email.trim(),
      password,
      notes: notes.trim(),
    };

    // Validate with the same schema the route uses, so the round-trip is only
    // spent on errors the browser genuinely cannot detect.
    const parsed = createClientSchema.safeParse(payload);
    if (!parsed.success) {
      setErrorKey("validationFailed");
      setFieldErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }

    mutation.mutate(payload);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(tCommon("copied"));
    } catch {
      toast.error(tCommon("unexpectedError"));
    }
  }

  // Credentials panel replaces the form once the client exists.
  if (credentials) {
    return (
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setCredentials(null);
          onOpenChange(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("credentials.title")}</DialogTitle>
            <DialogDescription>{t("credentials.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <CredentialRow
              label={t("credentials.email")}
              value={credentials.email}
              onCopy={() => copy(credentials.email)}
              copyLabel={tCommon("copy")}
            />
            <CredentialRow
              label={t("credentials.password")}
              value={credentials.password}
              onCopy={() => copy(credentials.password)}
              copyLabel={tCommon("copy")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-white/10"
              onClick={() => copy(`${credentials.email}\n${credentials.password}`)}
            >
              <Copy className="size-3.5" aria-hidden />
              {t("credentials.copyAll")}
            </Button>
            <Button
              type="button"
              className="button-primary text-white"
              onClick={() => {
                setCredentials(null);
                onOpenChange(false);
              }}
            >
              <Check className="size-3.5" aria-hidden />
              {t("credentials.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("create.title")}</DialogTitle>
          <DialogDescription>{t("create.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="client-name">{t("create.name")}</FieldLabel>
              <Input
                id="client-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("create.namePlaceholder")}
                required
                disabled={mutation.isPending}
                className="border-white/10 bg-white/[0.02]"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="client-company">{t("create.company")}</FieldLabel>
              <Input
                id="client-company"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder={t("create.companyPlaceholder")}
                disabled={mutation.isPending}
                className="border-white/10 bg-white/[0.02]"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="client-email">{t("create.email")}</FieldLabel>
              <Input
                id="client-email"
                type="email"
                dir="ltr"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={mutation.isPending}
                className="border-white/10 bg-white/[0.02]"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="client-password">{t("create.password")}</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="client-password"
                  type="text"
                  dir="ltr"
                  autoComplete="off"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={mutation.isPending}
                  className="border-white/10 bg-white/[0.02] font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPassword(suggestPassword())}
                  disabled={mutation.isPending}
                  className="shrink-0 border-white/10"
                >
                  <RefreshCw className="size-3.5" aria-hidden />
                  {t("create.generate")}
                </Button>
              </div>
              <FieldDescription>{t("create.passwordHint")}</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="client-notes">{t("create.notes")}</FieldLabel>
              <Textarea
                id="client-notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t("create.notesPlaceholder")}
                disabled={mutation.isPending}
                className="border-white/10 bg-white/[0.02]"
              />
            </Field>

            {errorKey && (
              <FieldError role="alert">
                <span>{tErrors(errorKey as never)}</span>
                {fieldErrors.length > 0 && (
                  <ul className="mt-1 list-disc space-y-0.5 ps-4 text-xs">
                    {fieldErrors.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                )}
              </FieldError>
            )}
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              className="border-white/10"
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="button-primary button-shine text-white"
            >
              {mutation.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {mutation.isPending ? tCommon("creating") : t("create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CredentialRow({
  label,
  value,
  onCopy,
  copyLabel,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copyLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p dir="ltr" className="truncate font-mono text-sm text-white">
          {value}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onCopy}
        aria-label={copyLabel}
        className="shrink-0 text-slate-400"
      >
        <Copy className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}
