import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk, parseBody, withAdmin, writeAuditLog } from "@/lib/api";
import { createClientSchema } from "@/lib/validation/schemas";
import { decodeCursor, encodeCursor, pageSize } from "@/lib/pagination";
import type { ClientRow } from "@/types/database";

type ClientWithCount = ClientRow & { reports: Array<{ count: number }> };

export const GET = withAdmin("listClients", async (_session, request) => {
  const url = new URL(request.url);
  const limit = pageSize(url.searchParams.get("limit") ?? undefined, 25);
  const cursor = decodeCursor(url.searchParams.get("cursor") ?? undefined);
  const previousDirection = url.searchParams.get("direction") === "prev";
  const term = (url.searchParams.get("q") ?? "").trim().slice(0, 100).replace(/[,()%]/g, " ").trim();
  const supabase = await createClient();
  let query = supabase.from("clients").select("*, reports(count)")
    .order("created_at", { ascending: previousDirection }).order("id", { ascending: previousDirection }).limit(limit + 1);
  if (term) query = query.or(`name.ilike.%${term}%,company_name.ilike.%${term}%,contact_email.ilike.%${term}%`);
  if (cursor) {
    const operator = previousDirection ? "gt" : "lt";
    query = query.or(`created_at.${operator}.${cursor.value},and(created_at.eq.${cursor.value},id.${operator}.${cursor.id})`);
  }
  const { data, error } = await query.returns<ClientWithCount[]>();
  if (error) throw error;
  const raw = data ?? [];
  const hasMore = raw.length > limit;
  const rows = raw.slice(0, limit);
  if (previousDirection) rows.reverse();
  const clients = rows.map(({ reports, ...client }) => ({ ...client, reportCount: reports?.[0]?.count ?? 0 }));
  const first = rows[0];
  const last = rows[rows.length - 1];
  return apiOk({
    clients,
    previousCursor: (previousDirection ? hasMore : Boolean(cursor)) && first ? encodeCursor({ value: first.created_at, id: first.id }) : null,
    nextCursor: (previousDirection ? Boolean(cursor) : hasMore) && last ? encodeCursor({ value: last.created_at, id: last.id }) : null,
  });
});

/**
 * Create a client organisation plus its login.
 *
 * Three writes have to succeed together: clients row, auth user, profile.
 * Postgres has no cross-service transaction with the auth API, so this
 * compensates instead — each failure path unwinds what came before it, so a
 * half-created client never survives (plan §27).
 */
export const POST = withAdmin("createClient", async (session, request) => {
  const parsed = await parseBody(request, createClientSchema);
  if (!parsed.ok) return parsed.response;

  const { name, companyName, email, password, notes } = parsed.data;
  const supabase = await createClient();
  const admin = createAdminClient();

  // 1. Client organisation (RLS-checked as the signed-in admin).
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      name,
      company_name: companyName?.trim() || null,
      contact_email: email,
      notes: notes?.trim() || null,
      is_active: true,
    })
    .select("*")
    .single();

  if (clientError || !client) throw clientError ?? new Error("client insert returned no row");

  // 2. Auth user. Service role: creating users is not expressible under RLS.
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (authError || !created.user) {
    await admin.from("clients").delete().eq("id", client.id);

    // 422 for a duplicate address so the form can point at the email field.
    const duplicate =
      authError?.status === 422 ||
      /already been registered|already exists/i.test(authError?.message ?? "");

    if (duplicate) return apiError(422, "emailTaken");

    console.error("[api:createClient:auth]", authError);
    return apiError(500, "serverError");
  }

  // 3. Profile binding the login to the tenant.
  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    role: "client",
    client_id: client.id,
    full_name: name,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.from("clients").delete().eq("id", client.id);
    console.error("[api:createClient:profile]", profileError);
    return apiError(500, "serverError");
  }

  await writeAuditLog(supabase, {
    actor_id: session.userId,
    action: "CLIENT_CREATED",
    entity_type: "client",
    entity_id: client.id,
    metadata: { email, name },
  });

  // The password is echoed back exactly once, for the admin to hand over.
  // It is never persisted (plan §28).
  return apiOk({ client, credentials: { email, password } }, 201);
});
