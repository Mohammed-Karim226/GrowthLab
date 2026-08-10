import { createClient } from "@/lib/supabase/server";
import { apiOk, notFound, parseBody, withAdmin, writeAuditLog } from "@/lib/api";
import { updateClientSchema } from "@/lib/validation/schemas";

type Params = { params: Promise<{ clientId: string }> };

export const PATCH = withAdmin<[Params]>(
  "updateClient",
  async (session, request, { params }) => {
    const { clientId } = await params;

    const parsed = await parseBody(request, updateClientSchema);
    if (!parsed.ok) return parsed.response;

    const input = parsed.data;
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.companyName !== undefined) patch.company_name = input.companyName || null;
    if (input.contactEmail !== undefined) patch.contact_email = input.contactEmail || null;
    if (input.notes !== undefined) patch.notes = input.notes || null;
    if (input.isActive !== undefined) patch.is_active = input.isActive;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("clients")
      .update(patch)
      .eq("id", clientId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return notFound();

    await writeAuditLog(supabase, {
      actor_id: session.userId,
      action: "CLIENT_UPDATED",
      entity_type: "client",
      entity_id: clientId,
      metadata: patch,
    });

    return apiOk({ client: data });
  }
);
