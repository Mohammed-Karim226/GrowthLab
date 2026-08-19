import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi, type SessionContext } from "@/lib/auth";

/**
 * Route-handler plumbing.
 *
 * Every response carries an `errorKey` rather than a message, so the UI can
 * translate it and no internal detail (SQL text, stack, provider payload)
 * reaches the browser. Real detail goes to the server log only.
 */

export type ApiError = { errorKey: string; details?: string[] };

export function apiError(status: number, errorKey: string, details?: string[]) {
  return NextResponse.json<ApiError>({ errorKey, details }, { status });
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export const unauthorized = () => apiError(401, "unauthorized");
export const forbidden = () => apiError(403, "forbidden");
export const notFound = () => apiError(404, "notFound");

/**
 * Log the real cause server-side, return something safe to the client.
 * `context` is a short call-site label, e.g. "createClient".
 */
export function serverError(context: string, cause: unknown) {
  console.error(`[api:${context}]`, cause);
  return apiError(500, "serverError");
}

/** Parse a JSON body against a schema, surfacing field paths but no internals. */
export async function parseBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: apiError(400, "invalidJson") };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) =>
      issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message
    );
    return { ok: false, response: apiError(422, "validationFailed", details) };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Wrap an admin-only route handler: enforces the admin check, converts thrown
 * errors into a safe 500, and hands the handler the verified session.
 */
export function withAdmin<T extends unknown[]>(
  context: string,
  handler: (session: SessionContext, request: Request, ...args: T) => Promise<NextResponse>
) {
  return async (request: Request, ...args: T): Promise<NextResponse> => {
    let session: SessionContext | null;
    try {
      session = await requireAdminApi();
    } catch (cause) {
      return serverError(`${context}:auth`, cause);
    }

    if (!session) return unauthorized();

    try {
      return await handler(session, request, ...args);
    } catch (cause) {
      return serverError(context, cause);
    }
  };
}

/**
 * Minimal shape of a Supabase insert builder.
 *
 * PostgrestFilterBuilder is thenable but not a real Promise, so this accepts any
 * awaitable that resolves to an error slot. Keeps writeAuditLog usable with both
 * the RLS client and the service-role client without importing either.
 */
type AuditWriter = {
  from: (table: "audit_logs") => {
    insert: (values: never) => PromiseLike<{ error: unknown }>;
  };
};

/** Best-effort audit write. A failure here must never fail the action itself. */
export async function writeAuditLog(
  db: AuditWriter,
  entry: {
    actor_id: string | null;
    action: string;
    entity_type?: string | null;
    entity_id?: string | null;
    metadata?: Record<string, unknown> | null;
  }
): Promise<void> {
  try {
    const { error } = await db.from("audit_logs").insert({
      actor_id: entry.actor_id,
      action: entry.action,
      entity_type: entry.entity_type ?? null,
      entity_id: entry.entity_id ?? null,
      metadata: entry.metadata ?? null,
    } as never);
    if (error) console.error("[audit]", entry.action, error);
  } catch (cause) {
    console.error("[audit]", entry.action, cause);
  }
}
