import { getTranslations } from "next-intl/server";

import ClientsView from "@/components/admin/ClientsView";
import { createClient } from "@/lib/supabase/server";
import { defaultLocale, isLocale } from "@/lib/i18n";
import type { ClientRow } from "@/types/database";

export const dynamic = "force-dynamic";

type ClientWithReports = ClientRow & { reports: Array<{ id: string }> };

export default async function AdminClientsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getTranslations({ locale, namespace: "admin.clients" });

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("*, reports(id)")
    .order("created_at", { ascending: false })
    .returns<ClientWithReports[]>();

  if (error) throw error;

  const clients = (data ?? []).map((client) => ({
    ...client,
    reportCount: client.reports?.length ?? 0,
  }));

  return (
    <div className="space-y-8">
      <header className="admin-section-header space-y-1.5">
        <h1 className="font-satoshi text-2xl text-white sm:text-3xl">{t("title")}</h1>
        <p className="max-w-xl text-sm text-slate-400">{t("subtitle")}</p>
      </header>

      <ClientsView clients={clients} locale={locale} />
    </div>
  );
}
