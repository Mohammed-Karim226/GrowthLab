import type { ClientGmailRow } from "@/types/database";

export const CREDENTIAL_METADATA_COLUMNS = "id, client_id, email, has_secret, services, created_at, updated_at";

/** Explicit projection even if a future caller accidentally fetches extra columns. */
export function credentialMetadata(row: ClientGmailRow): ClientGmailRow {
  return {
    id: row.id, client_id: row.client_id, email: row.email,
    has_secret: row.has_secret === true,
    services: (row.services ?? []).map((service) => ({
      id: service.id, service: service.service, username: service.username,
      has_secret: service.has_secret === true,
    })),
    created_at: row.created_at, updated_at: row.updated_at,
  };
}
