import { createClient } from "@/lib/supabase/server";
import { apiError, apiOk, notFound, parseBody, withAdmin, writeAuditLog } from "@/lib/api";
import { clientGmailSchema } from "@/lib/validation/schemas";

type Params = { params: Promise<{ clientId: string }> };

export const GET = withAdmin<[Params]>("listGmailAccounts", async (_session, _request, { params }) => {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_gmail_accounts").select("*").eq("client_id", clientId).order("created_at");
  if (error) throw error;
  return apiOk({ accounts: data ?? [] });
});

export const POST = withAdmin<[Params]>("createGmailAccount", async (session, request, { params }) => {
  const { clientId } = await params;
  const parsed = await parseBody(request, clientGmailSchema);
  if (!parsed.ok) return parsed.response;
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!client) return notFound();
  const input = parsed.data;
  const { data, error } = await supabase.from("client_gmail_accounts").insert({ client_id: clientId, email: input.email, password: input.password, notes: input.notes || null, related_accounts: input.relatedAccounts }).select("*").single();
  if (error) { if (error.code === "23505") return apiError(409, "gmailExists"); throw error; }
  await writeAuditLog(supabase, { actor_id: session.userId, action: "GMAIL_ACCOUNT_CREATED", entity_type: "client_gmail_account", entity_id: data.id, metadata: { clientId, email: input.email } });
  return apiOk({ account: data }, 201);
});
