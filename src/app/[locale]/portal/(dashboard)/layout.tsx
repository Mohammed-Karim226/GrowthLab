import type { Metadata } from "next";

import PortalShell from "@/components/portal/PortalShell";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AccountRow, ClientPaymentPlanRow } from "@/types/database";

// Every portal page reads the live session; nothing here may be prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Server-side guard. The proxy redirect is a convenience; this is the gate,
  // and it also asserts the tenant binding every page below depends on.
  const session = await requireClient(locale);
  const supabase = await createClient();
  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("client_id", session.clientId)
    .order("platform")
    .order("page_name");
  if (error) throw error;
  const { data: payments, error: paymentsError } = await supabase
    .from("client_payment_plans")
    .select("*")
    .eq("client_id", session.clientId)
    .order("billing_month", { ascending: false })
    .limit(12)
    .returns<ClientPaymentPlanRow[]>();
  if (paymentsError) throw paymentsError;

  return (
    <PortalShell
      clientName={session.profile.full_name ?? "GrowthLab"}
      clientEmail={session.email}
      accounts={(accounts ?? []) as AccountRow[]}
      payments={payments ?? []}
    >
      {children}
    </PortalShell>
  );
}
