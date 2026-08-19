import { createClient } from "@/lib/supabase/server";
import { apiError, apiOk, notFound, parseBody, withAdmin, writeAuditLog } from "@/lib/api";
import { createAccountSchema } from "@/lib/validation/schemas";

type Params = { params: Promise<{ clientId: string }> };

export const POST = withAdmin<[Params]>("createAccount", async (session, request, { params }) => {
  const { clientId } = await params;
  const parsed = await parseBody(request, createAccountSchema);
  if (!parsed.ok) return parsed.response;
  const supabase = await createClient();

  const { data: client, error: clientError } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (clientError) throw clientError;
  if (!client) return notFound();

  const input = parsed.data;
  const { data, error } = await supabase.from("accounts").insert({
    client_id: clientId,
    platform: input.platform,
    page_name: input.pageName,
    page_id: input.pageId || null,
    stage: input.stage || null,
  }).select("*").single();

  if (error?.code === "23505") return apiError(409, "accountExists");
  if (error) throw error;
  await writeAuditLog(supabase, { actor_id: session.userId, action: "ACCOUNT_CREATED", entity_type: "account", entity_id: data.id, metadata: { clientId, platform: input.platform } });
  return apiOk({ account: data }, 201);
});
