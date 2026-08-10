"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiRequestError, apiPost } from "@/lib/api-client";
import { createReportSchema } from "@/lib/validation/schemas";
import type { ReportRow, ReportVersionRow } from "@/types/database";

type CreateResponse = { report: ReportRow; version: ReportVersionRow };

export default function CreateReportDialog({
  clientId,
  open,
  onOpenChange,
  onCreated,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (reportId: string) => void;
}) {
  const t = useTranslations("admin.reports.create");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("admin.errors");

  const [title, setTitle] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  function reset() {
    setTitle("");
    setPeriodStart("");
    setPeriodEnd("");
    setErrorKey(null);
    setFieldErrors([]);
  }

  const mutation = useMutation({
    mutationFn: (input: Record<string, string>) =>
      apiPost<CreateResponse>("/api/admin/reports", input),
    onSuccess: (data) => {
      reset();
      onCreated(data.report.id);
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

    const payload = { clientId, title: title.trim(), periodStart, periodEnd };

    const parsed = createReportSchema.safeParse(payload);
    if (!parsed.success) {
      setErrorKey("validationFailed");
      setFieldErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }

    mutation.mutate(payload);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="report-title">{t("titleField")}</FieldLabel>
              <Input
                id="report-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("titlePlaceholder")}
                required
                disabled={mutation.isPending}
                className="border-white/10 bg-white/[0.02]"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="period-start">{t("periodStart")}</FieldLabel>
                <Input
                  id="period-start"
                  type="date"
                  dir="ltr"
                  value={periodStart}
                  onChange={(event) => setPeriodStart(event.target.value)}
                  required
                  disabled={mutation.isPending}
                  className="border-white/10 bg-white/[0.02]"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="period-end">{t("periodEnd")}</FieldLabel>
                <Input
                  id="period-end"
                  type="date"
                  dir="ltr"
                  value={periodEnd}
                  min={periodStart || undefined}
                  onChange={(event) => setPeriodEnd(event.target.value)}
                  required
                  disabled={mutation.isPending}
                  className="border-white/10 bg-white/[0.02]"
                />
              </Field>
            </div>

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
              {mutation.isPending ? tCommon("creating") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
