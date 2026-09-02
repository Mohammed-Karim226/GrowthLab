import { createClient } from "@/lib/supabase/server";
import { apiError, apiOk, parseBody, withAdmin, writeAuditLog } from "@/lib/api";
import { updateClientGmailSchema } from "@/lib/validation/schemas";
type Params = { params: Promise<{ accountId: string }> };

export const PATCH = withAdmin<[Params]>("updateGmailAccount", async (session, request, { params }) => {
  const { accountId } = await params;
  const parsed = await parseBody(request, updateClientGmailSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  const patch = { ...(input.email !== undefined ? { email: input.email } : {}), ...(input.password !== undefined ? { password: input.password } : {}), ...(input.notes !== undefined ? { notes: input.notes || null } : {}), ...(input.relatedAccounts !== undefined ? { related_accounts: input.relatedAccounts } : {}) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_gmail_accounts").update(patch).eq("id", accountId).select("*").maybeSingle();
  if (error) { if (error.code === "23505") return apiError(409, "gmailExists"); throw error; }
  if (!data) return apiError(404, "notFound");
  await writeAuditLog(supabase, { actor_id: session.userId, action: "GMAIL_ACCOUNT_UPDATED", entity_type: "client_gmail_account", entity_id: accountId, metadata: { fields: Object.keys(patch) } });
  return apiOk({ account: data });
});

export const DELETE = withAdmin<[Params]>("deleteGmailAccount", async (session, _request, { params }) => {
  const { accountId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_gmail_accounts").delete().eq("id", accountId).select("id").maybeSingle();
  if (error) throw error;
  if (!data) return apiError(404, "notFound");
  await writeAuditLog(supabase, { actor_id: session.userId, action: "GMAIL_ACCOUNT_DELETED", entity_type: "client_gmail_account", entity_id: accountId });
  return apiOk({ deleted: accountId });
});
