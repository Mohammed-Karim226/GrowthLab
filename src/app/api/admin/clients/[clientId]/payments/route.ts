import { createClient } from "@/lib/supabase/server";
import { apiError, apiOk, notFound, parseBody, withAdmin, writeAuditLog } from "@/lib/api";
import { paymentPlanSchema, updatePaymentPlanSchema } from "@/lib/validation/schemas";
import type { ClientPaymentPlanRow } from "@/types/database";

type Params = { params: Promise<{ clientId: string }> };

export const GET = withAdmin<[Params]>("listClientPayments", async (_session, _request, { params }) => {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_payment_plans").select("*").eq("client_id", clientId).order("billing_month", { ascending: false }).returns<ClientPaymentPlanRow[]>();
  if (error) throw error;
  return apiOk({ payments: data ?? [] });
});

export const POST = withAdmin<[Params]>("createClientPayment", async (session, request, { params }) => {
  const { clientId } = await params;
  const parsed = await parseBody(request, paymentPlanSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_payment_plans").insert({
    client_id: clientId,
    billing_month: input.billingMonth,
    amount: input.amount,
    total_plan_price: input.totalPlanPrice ?? null,
    currency: input.currency.toUpperCase(),
    status: input.status,
    due_date: input.dueDate ?? null,
    notes: input.notes ?? null,
    paid_at: input.status === "paid" ? new Date().toISOString() : null,
  }).select("*").single<ClientPaymentPlanRow>();
  if (error?.code === "23505") return apiError(409, "paymentMonthExists");
  if (error || !data) throw error ?? new Error("payment insert failed");
  await writeAuditLog(supabase, { actor_id: session.userId, action: "CLIENT_PAYMENT_CREATED", entity_type: "client_payment_plan", entity_id: data.id, metadata: { clientId, billingMonth: input.billingMonth } });
  return apiOk({ payment: data }, 201);
});

export const PATCH = withAdmin<[Params]>("updateClientPayment", async (session, request, { params }) => {
  const { clientId } = await params;
  const url = new URL(request.url);
  const paymentId = url.searchParams.get("paymentId");
  if (!paymentId) return notFound();
  const parsed = await parseBody(request, updatePaymentPlanSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  const patch: Record<string, unknown> = {};
  if (input.billingMonth !== undefined) patch.billing_month = input.billingMonth;
  if (input.amount !== undefined) patch.amount = input.amount;
  if (input.totalPlanPrice !== undefined) patch.total_plan_price = input.totalPlanPrice;
  if (input.currency !== undefined) patch.currency = input.currency.toUpperCase();
  if (input.status !== undefined) patch.status = input.status;
  if (input.dueDate !== undefined) patch.due_date = input.dueDate;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.paidAt !== undefined) patch.paid_at = input.paidAt;
  if (input.status === "paid") patch.paid_at = input.paidAt ?? new Date().toISOString();
  else if (input.status !== undefined && input.paidAt === undefined) patch.paid_at = null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_payment_plans").update(patch).eq("id", paymentId).eq("client_id", clientId).select("*").maybeSingle<ClientPaymentPlanRow>();
  if (error) throw error;
  if (!data) return notFound();
  await writeAuditLog(supabase, { actor_id: session.userId, action: "CLIENT_PAYMENT_UPDATED", entity_type: "client_payment_plan", entity_id: data.id, metadata: patch });
  return apiOk({ payment: data });
});

export const DELETE = withAdmin<[Params]>("deleteClientPayment", async (session, request, { params }) => {
  const { clientId } = await params;
  const paymentId = new URL(request.url).searchParams.get("paymentId");
  if (!paymentId) return notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_payment_plans").delete().eq("id", paymentId).eq("client_id", clientId).select("id").maybeSingle<{ id: string }>();
  if (error) throw error;
  if (!data) return notFound();
  await writeAuditLog(supabase, { actor_id: session.userId, action: "CLIENT_PAYMENT_DELETED", entity_type: "client_payment_plan", entity_id: data.id, metadata: { clientId } });
  return apiOk({ deleted: data.id });
});
