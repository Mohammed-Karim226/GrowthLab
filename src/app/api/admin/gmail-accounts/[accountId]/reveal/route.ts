import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk, notFound, withAdmin } from "@/lib/api";
import { clientGmailSchema } from "@/lib/validation/schemas";
import { decryptSecret, validateEncryptionConfiguration } from "@/lib/security/secrets";
import type { RevealedGmailCredentials } from "@/types/credentials";

type Params = { params: Promise<{ accountId: string }> };

// POST keeps password retrieval out of page prefetching and routine account reads.
export const POST = withAdmin<[Params]>("revealGmailAccount", async (session, _request, { params }) => {
  const { accountId } = await params;
  if (!z.string().uuid().safeParse(accountId).success) return notFound();

  // Check row access with the caller's session before reading restricted ciphertext.
  const db = await createClient();
  const { data: account, error: lookupError } = await db.from("client_gmail_accounts")
    .select("id, client_id, has_secret").eq("id", accountId).maybeSingle();
  if (lookupError) throw lookupError;
  if (!account) return notFound();
  if (!account.has_secret) return apiError(409, "credentialUnavailable");

  validateEncryptionConfiguration();
  const admin = createAdminClient();
  const { data: stored, error: readError } = await admin.from("client_gmail_accounts")
    .select("secret_ciphertext").eq("id", accountId).eq("client_id", account.client_id)
    .maybeSingle<{ secret_ciphertext: string | null }>();
  if (readError) throw readError;
  if (!stored) return notFound();
  if (!stored.secret_ciphertext) return apiError(409, "credentialUnavailable");

  let credentials: RevealedGmailCredentials;
  try {
    const decrypted = clientGmailSchema.parse(decryptSecret(stored.secret_ciphertext, `${account.client_id}:${accountId}`));
    credentials = { password: decrypted.password, relatedAccounts: decrypted.relatedAccounts };
  } catch {
    return apiError(409, "credentialUnavailable");
  }

  // A reveal must be auditable before plaintext is returned. Never log its values.
  const { error: auditError } = await admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: "CREDENTIAL_REVEALED",
    entity_type: "client_gmail_account",
    entity_id: accountId,
    metadata: { clientId: account.client_id },
  });
  if (auditError) throw auditError;

  // withAdmin marks the response no-store and logs only request metadata.
  return apiOk({ credentials });
});
