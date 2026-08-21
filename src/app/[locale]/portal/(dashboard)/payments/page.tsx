import PaymentsDashboard from "@/components/portal/PaymentsDashboard";
import { requireClient } from "@/lib/auth";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import type { AccountRow, ClientPaymentPlanRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const session = await requireClient(locale);
  const supabase = await createClient();

  const [{ data: payments, error: paymentsError }, { data: accounts, error: accountsError }] = await Promise.all([
    supabase.from("client_payment_plans").select("*").eq("client_id", session.clientId).order("billing_month", { ascending: false }).returns<ClientPaymentPlanRow[]>(),
    supabase.from("accounts").select("*").eq("client_id", session.clientId).order("platform").returns<AccountRow[]>(),
  ]);

  if (paymentsError) throw paymentsError;
  if (accountsError) throw accountsError;

  return <PaymentsDashboard payments={payments ?? []} accounts={accounts ?? []} locale={locale} />;
}
