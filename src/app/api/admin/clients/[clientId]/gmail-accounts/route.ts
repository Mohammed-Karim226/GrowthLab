import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk, notFound, parseBody, withAdmin } from "@/lib/api";
import { clientGmailSchema } from "@/lib/validation/schemas";
import { encryptSecret } from "@/lib/security/secrets";
import { errorCategory } from "@/lib/security/logging";
import { CREDENTIAL_METADATA_COLUMNS, credentialMetadata } from "@/lib/security/credential-metadata";
import type { ClientGmailRow } from "@/types/database";

type Params = { params: Promise<{ clientId: string }> };
export const GET = withAdmin<[Params]>("listGmailAccounts", async (_session, request, { params }) => {
  const { clientId } = await params;
  const after = new URL(request.url).searchParams.get("after");
  const db = await createClient();
  let query = db.from("client_gmail_accounts").select(CREDENTIAL_METADATA_COLUMNS).eq("client_id", clientId).order("id").limit(51);
  if (after && /^[0-9a-f-]{36}$/i.test(after)) query = query.gt("id", after);
  const { data, error } = await query.returns<ClientGmailRow[]>();
  if (error) throw error;
  const accounts = (data ?? []).slice(0, 50).map(credentialMetadata);
  return apiOk({ accounts, nextCursor: (data?.length ?? 0) > 50 ? accounts.at(-1)?.id : null });
});
export const POST = withAdmin<[Params]>("createGmailAccount", async (session, request, { params }) => {
  const { clientId } = await params;
  const parsed = await parseBody(request, clientGmailSchema);
  if (!parsed.ok) return parsed.response;
  const db = await createClient();
  const { data: client, error: clientError } = await db.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (clientError) throw clientError;
  if (!client) return notFound();
  const id = randomUUID();
  const input = parsed.data;
  const services = input.relatedAccounts.map(({ id, service, username }) => ({ id, service, username, has_secret: true }));
  const { error } = await createAdminClient().rpc("save_credential", {
    p_id: id, p_client: clientId, p_email: input.email, p_actor: session.userId,
    p_ciphertext: encryptSecret(input, `${clientId}:${id}`), p_services: services,
  });
  // The only unique index here is (client_id, lower(email)); `on conflict (id)` cannot absorb it.
  if (error) {
    if (errorCategory(error) === "23505") return apiError(409, "gmailExists");
    throw error;
  }
  const { data, error: readError } = await db.from("client_gmail_accounts").select(CREDENTIAL_METADATA_COLUMNS).eq("id", id).single<ClientGmailRow>();
  if (readError) throw readError;
  return apiOk({ account: credentialMetadata(data) }, 201);
});
