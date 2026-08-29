import { createClient } from "@/lib/supabase/server";
import { apiError, apiOk, notFound, parseBody, withAdmin, writeAuditLog } from "@/lib/api";
import { updateAccountSchema } from "@/lib/validation/schemas";

type Params = { params: Promise<{ accountId: string }> };

export const PATCH = withAdmin<[Params]>("updateAccount", async (session, request, { params }) => {
  const { accountId } = await params;
  const parsed = await parseBody(request, updateAccountSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  const patch: Record<string, unknown> = {};
  const supabase = await createClient();
  if (input.platform !== undefined) {
    const { data: existing, error: existingError } = await supabase.from("accounts").select("platform").eq("id", accountId).maybeSingle<{ platform: string }>();
    if (existingError) throw existingError;
    if (!existing) return notFound();
    if (existing.platform !== input.platform) {
      const { count, error: useError } = await supabase.from("insight_batches").select("id", { count: "exact", head: true }).eq("account_id", accountId);
      if (useError) throw useError;
      if ((count ?? 0) > 0) return apiError(409, "accountPlatformLocked");
      patch.platform = input.platform;
    }
  }
  if (input.pageName !== undefined) patch.page_name = input.pageName;
  if (input.pageId !== undefined) patch.page_id = input.pageId || null;
  if (input.stage !== undefined) patch.stage = input.stage || null;
  const { data, error } = await supabase.from("accounts").update(patch).eq("id", accountId).select("*").maybeSingle();
  if (error?.code === "23505") return apiError(409, "accountExists");
  if (error?.code === "23503") return apiError(409, "accountInUse");
  if (error) throw error;
  if (!data) return notFound();
  await writeAuditLog(supabase, { actor_id: session.userId, action: "ACCOUNT_UPDATED", entity_type: "account", entity_id: accountId, metadata: patch });
  return apiOk({ account: data });
});

export const DELETE = withAdmin<[Params]>("deleteAccount", async (session, _request, { params }) => {
  const { accountId } = await params;
  const supabase = await createClient();
  const { count, error: useError } = await supabase.from("insight_batches").select("id", { count: "exact", head: true }).eq("account_id", accountId);
  if (useError) throw useError;
  if ((count ?? 0) > 0) return apiError(409, "accountInUse");
  const { data, error } = await supabase.from("accounts").delete().eq("id", accountId).select("id").maybeSingle();
  if (error) throw error;
  if (!data) return notFound();
  await writeAuditLog(supabase, { actor_id: session.userId, action: "ACCOUNT_DELETED", entity_type: "account", entity_id: accountId });
  return apiOk({ deleted: accountId });
});
