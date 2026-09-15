import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiOk, notFound, parseBody, withAdmin } from "@/lib/api";
import { clientGmailSchema } from "@/lib/validation/schemas";
import { encryptSecret } from "@/lib/security/secrets";
import { CREDENTIAL_METADATA_COLUMNS, credentialMetadata } from "@/lib/security/credential-metadata";
import type { ClientGmailRow } from "@/types/database";
type Params = { params: Promise<{ accountId: string }> };

// Replacement is write-only. The operator supplies the full new secret set.
export const PATCH = withAdmin<[Params]>("replaceGmailAccount", async (session, request, { params }) => {
  const { accountId } = await params;
  const parsed = await parseBody(request, clientGmailSchema);
  if (!parsed.ok) return parsed.response;
  const db = await createClient();
  const { data: existing, error: lookupError } = await db.from("client_gmail_accounts").select(CREDENTIAL_METADATA_COLUMNS).eq("id", accountId).maybeSingle<ClientGmailRow>();
  if (lookupError) throw lookupError;
  if (!existing) return notFound();
  const input = parsed.data;
  const { error } = await createAdminClient().rpc("save_credential", {
    p_id: accountId, p_client: existing.client_id, p_email: input.email, p_actor: session.userId,
    p_ciphertext: encryptSecret(input, `${existing.client_id}:${accountId}`),
    p_services: input.relatedAccounts.map(({ id, service, username }) => ({ id, service, username, has_secret: true })),
  });
  if (error) throw error;
  const { data, error: readError } = await db.from("client_gmail_accounts").select(CREDENTIAL_METADATA_COLUMNS).eq("id", accountId).single<ClientGmailRow>();
  if (readError) throw readError;
  return apiOk({ account: credentialMetadata(data) });
});
export const DELETE = withAdmin<[Params]>("deleteGmailAccount", async (session, _request, { params }) => {
  const { accountId } = await params;
  const { error } = await createAdminClient().rpc("delete_credential", { p_id: accountId, p_actor: session.userId });
  if (error) throw error;
  return apiOk({ deleted: accountId });
});
