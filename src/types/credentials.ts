import type { ClientGmailRelatedAccount } from "@/types/database";

/** Returned only by the explicit admin password reveal endpoint. */
export type RevealedGmailCredentials = {
  password: string;
  relatedAccounts: ClientGmailRelatedAccount[];
};
