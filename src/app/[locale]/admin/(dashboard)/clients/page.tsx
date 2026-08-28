import { getTranslations } from "next-intl/server";
import ClientsView from "@/components/admin/ClientsView";
import { createClient } from "@/lib/supabase/server";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { decodeCursor, encodeCursor } from "@/lib/pagination";
import type { ClientRow } from "@/types/database";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 10;
type ClientWithCount = ClientRow & { reports: Array<{ count: number }> };

export default async function AdminClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cursor?: string; direction?: string; q?: string; page?: string }>;
}) {
  const [{ locale: raw }, search] = await Promise.all([params, searchParams]);
  const locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getTranslations({ locale, namespace: "admin.clients" });
  const cursor = decodeCursor(search.cursor);
  const previousDirection = search.direction === "prev";
  const searchTerm = (search.q ?? "").trim().slice(0, 100);
  const requestedPage = Number(search.page ?? "1");
  const currentPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const safeTerm = searchTerm.replace(/[,()%]/g, " ").trim();
  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select("*, reports(count)")
    .order("created_at", { ascending: previousDirection })
    .order("id", { ascending: previousDirection })
    .limit(PAGE_SIZE + 1);
  if (safeTerm)
    query = query.or(
      `name.ilike.%${safeTerm}%,company_name.ilike.%${safeTerm}%,contact_email.ilike.%${safeTerm}%`,
    );
  if (cursor) {
    const operator = previousDirection ? "gt" : "lt";
    query = query.or(
      `created_at.${operator}.${cursor.value},and(created_at.eq.${cursor.value},id.${operator}.${cursor.id})`,
    );
  }
  let countQuery = supabase.from("clients").select("id", { count: "exact", head: true });
  if (safeTerm) countQuery = countQuery.or(`name.ilike.%${safeTerm}%,company_name.ilike.%${safeTerm}%,contact_email.ilike.%${safeTerm}%`);
  const [{ data, error }, { count: totalClients, error: countError }] = await Promise.all([
    query.returns<ClientWithCount[]>(),
    countQuery,
  ]);
  if (error) throw error;
  if (countError) throw countError;
  const rawRows = data ?? [];
  const hasMore = rawRows.length > PAGE_SIZE;
  const rows = rawRows.slice(0, PAGE_SIZE);
  if (previousDirection) rows.reverse();
  const clients = rows.map(({ reports, ...client }) => ({
    ...client,
    reportCount: reports?.[0]?.count ?? 0,
  }));
  const first = rows[0];
  const last = rows[rows.length - 1];
  const base = `/${locale}/admin/clients`;
  const href = (
    row: ClientWithCount | undefined,
    direction: "next" | "prev",
  ) => {
    if (!row) return null;
    const values = new URLSearchParams({
      cursor: encodeCursor({ value: row.created_at, id: row.id }),
      direction,
    });
    if (searchTerm) values.set("q", searchTerm);
    values.set("page", String(direction === "next" ? currentPage + 1 : Math.max(1, currentPage - 1)));
    return `${base}?${values}`;
  };
  const previousHref = (previousDirection ? hasMore : Boolean(cursor))
    ? href(first, "prev")
    : null;
  const nextHref = (previousDirection ? Boolean(cursor) : hasMore)
    ? href(last, "next")
    : null;

  return (
    <div className="space-y-8">
      <header className="admin-section-header space-y-1.5">
        <h1 className="font-satoshi text-2xl text-white sm:text-3xl">
          {t("title")}
        </h1>
        <p className="max-w-xl text-sm text-slate-400">{t("subtitle")}</p>
      </header>
      <ClientsView
        clients={clients}
        locale={locale}
        query={searchTerm}
        previousHref={previousHref}
        nextHref={nextHref}
        currentPage={currentPage}
        totalClients={totalClients ?? 0}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
