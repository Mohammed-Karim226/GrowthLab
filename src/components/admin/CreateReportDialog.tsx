"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { CalendarDays, FilePlus2, Loader2 } from "lucide-react";

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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
              <FilePlus2 className="size-4" />
            </span>
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup className="gap-5 pt-1">
            <Field>
              <FieldLabel htmlFor="report-title">{t("titleField")}</FieldLabel>
              <Input
                id="report-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("titlePlaceholder")}
                required
                disabled={mutation.isPending}
                className="h-11 rounded-xl border-white/[0.12] bg-black/20 px-3.5"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="period-start">{t("periodStart")}</FieldLabel>
                <ReportDateField value={periodStart} onChange={setPeriodStart} label={t("periodStart")} disabled={mutation.isPending} />
              </Field>

              <Field>
                <FieldLabel htmlFor="period-end">{t("periodEnd")}</FieldLabel>
                <ReportDateField value={periodEnd} onChange={setPeriodEnd} label={t("periodEnd")} minDate={periodStart} disabled={mutation.isPending} />
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
              className="h-10 rounded-xl border-white/[0.12] bg-white/[0.03] px-4 hover:bg-white/[0.08]"
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="h-10 rounded-xl bg-cyan-300 px-5 font-semibold text-slate-950 shadow-[0_8px_24px_rgba(103,232,249,0.18)] hover:bg-cyan-200"
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

function ReportDateField({ value, onChange, label, minDate, disabled }: { value: string; onChange: (value: string) => void; label: string; minDate?: string; disabled?: boolean }) {
  const selected = parseLocalDate(value);
  const minimum = parseLocalDate(minDate || "");
  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="outline" disabled={disabled} className="h-11 w-full justify-start rounded-xl border-white/[0.12] bg-black/20 px-3 text-start font-normal text-slate-200 shadow-none hover:bg-white/[0.06]" />}>
        <CalendarDays className="me-2 size-4 text-cyan-200/70" />
        {value || <span className="text-slate-500">{label}</span>}
      </PopoverTrigger>
      <PopoverContent className="w-auto border-white/[0.12] bg-[#0b1020] p-2">
        <Calendar mode="single" selected={selected} disabled={minimum ? { before: minimum } : undefined} onSelect={(date) => date && onChange(formatLocalDate(date))} defaultMonth={selected || minimum} />
      </PopoverContent>
    </Popover>
  );
}

function parseLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
