"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CalendarDays, Check, CreditCard, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { apiDelete, apiPatch, apiPost, ApiRequestError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ClientPaymentPlanRow, PaymentStatus } from "@/types/database";

type PaymentDraft = { billingMonth: string; amount: string; totalPlanPrice: string; currency: string; dueDate: string; status: PaymentStatus; notes: string };
const emptyDraft = (): PaymentDraft => ({ billingMonth: new Date().toISOString().slice(0, 10), amount: "", totalPlanPrice: "", currency: "USD", dueDate: "", status: "pending", notes: "" });
const CURRENCIES = ["USD", "GBP", "EUR", "AED", "SAR", "EGP", "CAD", "AUD", "JPY", "CHF"] as const;

export default function PaymentPlanManager({ clientId, initial }: { clientId: string; initial: ClientPaymentPlanRow[] }) {
  const t = useTranslations("admin.clients.detail.payments");
  const [payments, setPayments] = useState(initial);
  const [draft, setDraft] = useState<PaymentDraft>(emptyDraft);
  const [editing, setEditing] = useState<ClientPaymentPlanRow | null>(null);
  const [editDraft, setEditDraft] = useState<PaymentDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sorted = useMemo(() => [...payments].sort((a, b) => b.billing_month.localeCompare(a.billing_month)), [payments]);

  const create = useMutation({
    mutationFn: () => apiPost<{ payment: ClientPaymentPlanRow }>(`/api/admin/clients/${clientId}/payments`, { ...draft, amount: draft.amount, totalPlanPrice: draft.totalPlanPrice || null, dueDate: draft.dueDate || null, notes: draft.notes || null }),
    onSuccess: ({ payment }) => { setPayments((rows) => [payment, ...rows]); setDraft(emptyDraft()); setError(null); toast.success(t("created")); },
    onError: (cause) => setError(cause instanceof ApiRequestError && cause.errorKey === "paymentMonthExists" ? t("monthExists") : t("saveError")),
  });
  const update = useMutation({
    mutationFn: ({ id, value }: { id: string; value: PaymentDraft }) => apiPatch<{ payment: ClientPaymentPlanRow }>(`/api/admin/clients/${clientId}/payments?paymentId=${id}`, { ...value, amount: value.amount, totalPlanPrice: value.totalPlanPrice || null, dueDate: value.dueDate || null, notes: value.notes || null }),
    onSuccess: ({ payment }) => { setPayments((rows) => rows.map((row) => row.id === payment.id ? payment : row)); setEditing(null); setEditDraft(null); setError(null); toast.success(t("updated")); },
    onError: () => setError(t("saveError")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: string }>(`/api/admin/clients/${clientId}/payments?paymentId=${id}`),
    onSuccess: (_, id) => { setPayments((rows) => rows.filter((row) => row.id !== id)); toast.success(t("deleted")); },
    onError: () => setError(t("deleteError")),
  });

  const setDraftValue = <K extends keyof PaymentDraft>(key: K, value: PaymentDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const setEditValue = <K extends keyof PaymentDraft>(key: K, value: PaymentDraft[K]) => setEditDraft((current) => current ? { ...current, [key]: value } : current);
  const startEdit = (payment: ClientPaymentPlanRow) => { setEditing(payment); setEditDraft({ billingMonth: payment.billing_month.slice(0, 10), amount: String(payment.amount), totalPlanPrice: payment.total_plan_price === null ? "" : String(payment.total_plan_price), currency: payment.currency, dueDate: payment.due_date ?? "", status: payment.status, notes: payment.notes ?? "" }); };

  return <Card className="admin-table-card border-[#d8be78]/20 bg-[#080b18]/75"><CardHeader><CardTitle className="flex items-center gap-2 text-sm text-white"><CreditCard className="size-4 text-[#d8be78]" />{t("title")}</CardTitle><p className="text-xs text-slate-500">{t("hint")}</p></CardHeader><CardContent className="space-y-5">
    <FieldGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field><FieldLabel>{t("month")}</FieldLabel><CalendarField value={draft.billingMonth} onChange={(value) => setDraftValue("billingMonth", value)} label={t("chooseDate")} /></Field>
      <Field><FieldLabel htmlFor="billing-amount">{t("amount")}</FieldLabel><Input id="billing-amount" type="number" min="0" step="0.01" value={draft.amount} onChange={(e) => setDraftValue("amount", e.target.value)} placeholder="0.00" className="border-white/10 bg-white/[0.035]" /></Field>
      <Field><FieldLabel htmlFor="billing-total">{t("totalPlanPrice")}</FieldLabel><Input id="billing-total" type="number" min="0" step="0.01" value={draft.totalPlanPrice} onChange={(e) => setDraftValue("totalPlanPrice", e.target.value)} placeholder="0.00" className="border-white/10 bg-white/[0.035]" /></Field>
      <Field><FieldLabel>{t("currency")}</FieldLabel><CurrencySelect value={draft.currency} onChange={(value) => setDraftValue("currency", value)} labels={currencyLabels(t)} /></Field>
      <Field><FieldLabel>{t("dueDate")}</FieldLabel><CalendarField value={draft.dueDate} onChange={(value) => setDraftValue("dueDate", value)} label={t("chooseDate")} /></Field>
      <Field><FieldLabel>{t("statusLabel")}</FieldLabel><StatusSelect value={draft.status} onChange={(value) => setDraftValue("status", value)} labels={{ pending: t("pending"), paid: t("paid"), overdue: t("overdue"), waived: t("waived") }} /></Field>
      <div className="flex items-end"><Button type="button" onClick={() => create.mutate()} disabled={!draft.amount || !draft.billingMonth || create.isPending} className="button-primary h-9 w-full"><Plus className="size-4" />{create.isPending ? <Loader2 className="size-4 animate-spin" /> : t("add")}</Button></div>
      <Field className="sm:col-span-2 lg:col-span-3"><FieldLabel htmlFor="billing-notes">{t("notes")}</FieldLabel><Textarea id="billing-notes" rows={2} value={draft.notes} onChange={(e) => setDraftValue("notes", e.target.value)} placeholder={t("notesPlaceholder")} className="border-white/10 bg-white/[0.035]" /></Field>
    </FieldGroup>
    {error && <p role="alert" className="rounded-lg border border-[#ef9978]/20 bg-[#ef9978]/[0.08] px-3 py-2 text-xs text-[#f3aa8d]">{error}</p>}
    <div className="space-y-2">{sorted.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 px-4 py-7 text-center text-xs text-slate-500">{t("empty")}</p> : sorted.map((payment) => <div key={payment.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><CalendarDays className="size-4 text-[#bca66e]" /><span className="w-20 text-xs font-medium text-slate-200">{payment.billing_month.slice(0, 7)}</span><span className="text-sm font-semibold text-white">{payment.amount} {payment.currency}</span><span className="text-xs text-slate-500">{payment.due_date ?? "—"}</span><span className={`rounded-full border px-2 py-1 text-[10px] uppercase ${payment.status === "paid" ? "border-[#54d8ac]/20 text-[#67ddb5]" : payment.status === "overdue" ? "border-[#ed8f6d]/20 text-[#f19b77]" : "border-[#d8be78]/20 text-[#e2c87e]"}`}>{t(payment.status)}</span><div className="basis-full ps-7 text-xs text-slate-500">{payment.notes || t("noNotes")}</div><div className="ms-auto flex items-center gap-1"><Button type="button" variant="ghost" size="icon-sm" onClick={() => startEdit(payment)} aria-label={t("edit")} className="text-slate-400 hover:text-white"><Pencil className="size-3.5" /></Button><Button type="button" variant="ghost" size="icon-sm" onClick={() => remove.mutate(payment.id)} disabled={remove.isPending} aria-label={t("remove")} className="text-slate-400 hover:text-[#f19b77]"><Trash2 className="size-3.5" /></Button></div></div>)}</div>
    <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) { setEditing(null); setEditDraft(null); } }}><DialogContent className="vip-dialog"><DialogHeader><DialogTitle>{t("editTitle")}</DialogTitle><DialogDescription>{t("editHint")}</DialogDescription></DialogHeader>{editDraft && <FieldGroup className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>{t("month")}</FieldLabel><CalendarField value={editDraft.billingMonth} onChange={(value) => setEditValue("billingMonth", value)} label={t("chooseDate")} /></Field><Field><FieldLabel>{t("amount")}</FieldLabel><Input type="number" min="0" step="0.01" value={editDraft.amount} onChange={(e) => setEditValue("amount", e.target.value)} /></Field><Field><FieldLabel>{t("totalPlanPrice")}</FieldLabel><Input type="number" min="0" step="0.01" value={editDraft.totalPlanPrice} onChange={(e) => setEditValue("totalPlanPrice", e.target.value)} /></Field><Field><FieldLabel>{t("currency")}</FieldLabel><CurrencySelect value={editDraft.currency} onChange={(value) => setEditValue("currency", value)} labels={currencyLabels(t)} /></Field><Field><FieldLabel>{t("dueDate")}</FieldLabel><CalendarField value={editDraft.dueDate} onChange={(value) => setEditValue("dueDate", value)} label={t("chooseDate")} /></Field><Field><FieldLabel>{t("statusLabel")}</FieldLabel><StatusSelect value={editDraft.status} onChange={(value) => setEditValue("status", value)} labels={{ pending: t("pending"), paid: t("paid"), overdue: t("overdue"), waived: t("waived") }} /></Field><Field className="sm:col-span-2"><FieldLabel htmlFor="edit-billing-notes">{t("notes")}</FieldLabel><Textarea id="edit-billing-notes" rows={3} value={editDraft.notes} onChange={(e) => setEditValue("notes", e.target.value)} placeholder={t("notesPlaceholder")} /></Field></FieldGroup>}<DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)}>{t("cancel")}</Button><Button type="button" className="button-primary" disabled={!editing || !editDraft?.amount || update.isPending} onClick={() => editing && editDraft && update.mutate({ id: editing.id, value: editDraft })}>{update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{t("save")}</Button></DialogFooter></DialogContent></Dialog>
  </CardContent></Card>;
}

function StatusSelect({ value, onChange, labels }: { value: PaymentStatus; onChange: (value: PaymentStatus) => void; labels: Record<PaymentStatus, string> }) {
  return <Select value={value} onValueChange={(next) => next && onChange(next as PaymentStatus)}><SelectTrigger className="border-white/10 bg-white/[0.035]"><SelectValue /></SelectTrigger><SelectContent className="border-white/10 bg-[#10152a] text-slate-200"><SelectItem value="pending">{labels.pending}</SelectItem><SelectItem value="paid">{labels.paid}</SelectItem><SelectItem value="overdue">{labels.overdue}</SelectItem><SelectItem value="waived">{labels.waived}</SelectItem></SelectContent></Select>;
}

function CurrencySelect({ value, onChange, labels }: { value: string; onChange: (value: string) => void; labels: Record<string, string> }) {
  return <Select value={value} onValueChange={(next) => next && onChange(next)}><SelectTrigger className="border-white/10 bg-white/[0.035]"><SelectValue /></SelectTrigger><SelectContent className="border-white/10 bg-[#10152a] text-slate-200">{CURRENCIES.map((currency) => <SelectItem key={currency} value={currency}>{currency} - {labels[currency] ?? currency}</SelectItem>)}</SelectContent></Select>;
}

function CalendarField({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const selected = value ? parseLocalDate(value) : undefined;
  return <Popover><PopoverTrigger render={<Button type="button" variant="outline" className="h-9 w-full justify-start border-white/10 bg-white/[0.035] text-start font-normal text-slate-300" />}><CalendarDays className="me-2 size-4 text-[#bca66e]" />{value || label}</PopoverTrigger><PopoverContent><Calendar mode="single" selected={selected} onSelect={(date) => date && onChange(formatLocalDate(date))} defaultMonth={selected} /></PopoverContent></Popover>;
}

function parseLocalDate(value: string) { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); }
function formatLocalDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function currencyLabels(t: ReturnType<typeof useTranslations>) { return Object.fromEntries(CURRENCIES.map((currency) => [currency, t(`currencyNames.${currency}` as never)])); }
