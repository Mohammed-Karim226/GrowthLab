import { z } from "zod";
import { apiOk, notFound, parseBody, withAdmin, writeAuditLog } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const outreachStatuses = ["draft", "ready", "sent", "replied", "no_reply", "closed"] as const;

const createSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("contact"), name: z.string().trim().min(2).max(120), email: z.string().email().max(240), company: z.string().trim().max(160).optional(), channel: z.string().trim().max(160).optional(), notes: z.string().trim().max(1000).optional() }),
  z.object({ kind: z.literal("sender"), name: z.string().trim().min(2).max(120), email: z.string().email().max(240), title: z.string().trim().max(160).optional(), signature: z.string().trim().max(500).optional() }),
  z.object({ kind: z.literal("message"), contactId: z.string().uuid(), senderId: z.string().uuid().nullable(), subject: z.string().trim().min(3).max(200), body: z.string().trim().min(10).max(10000), goal: z.string().trim().max(500).optional(), status: z.enum(["draft", "ready"]).default("draft") }),
]);

const updateSchema = z.union([
  z.object({ id: z.string().uuid(), status: z.enum(["draft", "ready", "sent", "replied", "no_reply", "closed"]) }).strict(),
  z.object({ kind: z.literal("message"), id: z.string().uuid(), subject: z.string().trim().min(3).max(200), body: z.string().trim().min(10).max(10000) }).strict(),
  z.object({ kind: z.literal("contact"), id: z.string().uuid(), name: z.string().trim().min(2).max(120), email: z.string().email().max(240), company: z.string().trim().max(160).optional(), channel: z.string().trim().max(160).optional(), notes: z.string().trim().max(1000).optional() }).strict(),
]);
const deleteSchema = z.union([
  z.object({ kind: z.literal("contact"), id: z.string().uuid() }).strict(),
  z.object({ kind: z.literal("message"), id: z.string().uuid() }).strict(),
  z.object({ clearAll: z.literal(true) }).strict(),
]);

export const GET = withAdmin("listOutreach", async (_session, request) => {
  const db = await createClient();
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const pageSize = Math.min(50, Math.max(25, Number(url.searchParams.get("pageSize") || "25")));
  const search = (url.searchParams.get("search") || "").trim();
  const status = url.searchParams.get("status");
  const contacts = await db.from("outreach_contacts").select("*").order("created_at", { ascending: false });
  const senders = await db.from("outreach_senders").select("*").order("is_default", { ascending: false }).order("created_at", { ascending: false });
  if (contacts.error) throw contacts.error;
  if (senders.error) throw senders.error;
  const matchingContactIds = search
    ? contacts.data.filter((contact) => `${contact.name} ${contact.email} ${contact.company || ""}`.toLowerCase().includes(search.toLowerCase())).map((contact) => contact.id)
    : [];
  let messageQuery = db.from("outreach_messages").select("*", { count: "exact" }).order("updated_at", { ascending: false });
  if (status && outreachStatuses.includes(status as (typeof outreachStatuses)[number])) messageQuery = messageQuery.eq("status", status as (typeof outreachStatuses)[number]);
  if (search) {
    const escapedSearch = search.replace(/[,%_().]/g, " ").trim();
    const clauses = [`subject.ilike.%${escapedSearch}%`, `body.ilike.%${escapedSearch}%`];
    if (matchingContactIds.length) clauses.push(`contact_id.in.(${matchingContactIds.join(",")})`);
    messageQuery = messageQuery.or(clauses.join(","));
  }
  const from = (page - 1) * pageSize;
  const messagesResult = await messageQuery.range(from, from + pageSize - 1);
  const statusCounts = await Promise.all(outreachStatuses.map(async (item) => {
    const result = await db.from("outreach_messages").select("id", { count: "exact", head: true }).eq("status", item);
    if (result.error) throw result.error;
    return [item, result.count || 0] as const;
  }));
  if (messagesResult.error) throw messagesResult.error;
  return apiOk({ contacts: contacts.data, senders: senders.data, messages: messagesResult.data || [], pagination: { page, pageSize, total: messagesResult.count || 0, hasMore: from + (messagesResult.data?.length || 0) < (messagesResult.count || 0) }, counts: Object.fromEntries(statusCounts) });
});

export const POST = withAdmin("createOutreach", async (session, request) => {
  const parsed = await parseBody(request, createSchema);
  if (!parsed.ok) return parsed.response;
  const db = await createClient();
  const input = parsed.data;
  let result;
  if (input.kind === "contact") result = await db.from("outreach_contacts").insert({ name: input.name, email: input.email, company: input.company || null, channel: input.channel || null, notes: input.notes || null }).select("*").single();
  else if (input.kind === "sender") result = await db.from("outreach_senders").insert({ name: input.name, email: input.email, title: input.title || null, signature: input.signature || null }).select("*").single();
  else result = await db.from("outreach_messages").insert({ contact_id: input.contactId, sender_id: input.senderId, subject: input.subject, body: input.body, goal: input.goal || null, status: input.status, created_by: session.userId, last_event: "Message created" }).select("*").single();
  if (result.error) throw result.error;
  await writeAuditLog(db, { actor_id: session.userId, action: `outreach.${input.kind}.created`, entity_type: `outreach_${input.kind}`, entity_id: result.data.id });
  return apiOk(result.data, 201);
});

export const PATCH = withAdmin("updateOutreachStatus", async (session, request) => {
  const parsed = await parseBody(request, updateSchema);
  if (!parsed.ok) return parsed.response;
  if ("kind" in parsed.data && parsed.data.kind === "contact") {
    const db = await createClient();
    const { data, error } = await db.from("outreach_contacts").update({ name: parsed.data.name, email: parsed.data.email, company: parsed.data.company || null, channel: parsed.data.channel || null, notes: parsed.data.notes || null }).eq("id", parsed.data.id).select("*").maybeSingle();
    if (error) throw error;
    if (!data) return notFound();
    await writeAuditLog(db, { actor_id: session.userId, action: "outreach.contact.updated", entity_type: "outreach_contact", entity_id: data.id });
    return apiOk(data);
  }
  if ("kind" in parsed.data && parsed.data.kind === "message") {
    const db = await createClient();
    const { data, error } = await db.from("outreach_messages").update({ subject: parsed.data.subject, body: parsed.data.body, last_event: "Message edited" }).eq("id", parsed.data.id).select("*").maybeSingle();
    if (error) throw error;
    if (!data) return notFound();
    await writeAuditLog(db, { actor_id: session.userId, action: "outreach.message.updated", entity_type: "outreach_message", entity_id: data.id });
    return apiOk(data);
  }
  const now = new Date().toISOString();
  if (!("status" in parsed.data)) return notFound();
  const values = { status: parsed.data.status, last_event: `Marked ${parsed.data.status.replace("_", " ")}`, ...(parsed.data.status === "sent" ? { sent_at: now } : {}), ...(parsed.data.status === "replied" ? { replied_at: now } : {}) };
  const db = await createClient();
  const { data, error } = await db.from("outreach_messages").update(values).eq("id", parsed.data.id).select("*").maybeSingle();
  if (error) throw error;
  if (!data) return notFound();
  await writeAuditLog(db, { actor_id: session.userId, action: "outreach.message.status_changed", entity_type: "outreach_message", entity_id: data.id, metadata: { status: parsed.data.status } });
  return apiOk(data);
});

export const DELETE = withAdmin("deleteOutreach", async (session, request) => {
  const parsed = await parseBody(request, deleteSchema);
  if (!parsed.ok) return parsed.response;
  const db = await createClient();
  if ("kind" in parsed.data && parsed.data.kind === "contact") {
    const { error } = await db.from("outreach_contacts").delete().eq("id", parsed.data.id);
    if (error) throw error;
    await writeAuditLog(db, { actor_id: session.userId, action: "outreach.contact.deleted", entity_type: "outreach_contact", entity_id: parsed.data.id });
    return apiOk({ deleted: parsed.data.id });
  }
  if ("clearAll" in parsed.data && parsed.data.clearAll) {
    const { error } = await db.from("outreach_messages").delete().not("id", "is", null);
    if (error) throw error;
    await writeAuditLog(db, { actor_id: session.userId, action: "outreach.messages.cleared", entity_type: "outreach_message", metadata: { scope: "all" } });
    return apiOk({ deleted: "all" });
  }
  if (!("kind" in parsed.data) || parsed.data.kind !== "message") return notFound();
  const { data, error } = await db.from("outreach_messages").delete().eq("id", parsed.data.id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) return notFound();
  await writeAuditLog(db, { actor_id: session.userId, action: "outreach.message.deleted", entity_type: "outreach_message", entity_id: parsed.data.id });
  return apiOk({ deleted: parsed.data.id });
});
