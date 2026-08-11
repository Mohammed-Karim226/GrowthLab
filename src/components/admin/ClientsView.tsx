"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Crown, Search, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import CreateClientDialog from "@/components/admin/CreateClientDialog";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { ClientRow } from "@/types/database";

export type ClientListItem = ClientRow & { reportCount: number };

/**
 * Client list with local search.
 *
 * Search filters the already-authorised rows in the browser: the server only
 * ever sent rows this admin may see, so no query is round-tripped per keystroke.
 */
export default function ClientsView({
  clients,
  locale,
}: {
  clients: ClientListItem[];
  locale: Locale;
}) {
  const t = useTranslations("admin.clients");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("status");
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients;

    return clients.filter((client) =>
      [client.name, client.company_name, client.contact_email]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle))
    );
  }, [clients, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="admin-search relative w-full max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={tCommon("search")}
            className="border-white/10 bg-white/[0.02] ps-9 text-slate-200"
          />
        </div>

        <Button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="button-primary button-shine h-10 rounded-full px-5 text-sm font-semibold text-white"
        >
          <Crown className="size-4" aria-hidden />
          {t("newClient")}
        </Button>
      </div>

      <Card className="admin-table-card">
        <CardContent className="p-0 sm:p-2">
          {clients.length === 0 ? (
            <EmptyState title={t("empty")} hint={t("emptyHint")} />
          ) : filtered.length === 0 ? (
            <EmptyState title={t("noMatches")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.06] hover:bg-transparent">
                  <TableHead>{t("columns.name")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("columns.company")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("columns.email")}</TableHead>
                  <TableHead>{t("columns.reports")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("columns.created")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((client) => (
                  <TableRow key={client.id} className="border-white/[0.06] hover:bg-white/[0.03]">
                    <TableCell>
                      <Link
                        href={`/${locale}/admin/clients/${client.id}`}
                        className="text-sm text-slate-100 underline-offset-4 hover:underline"
                      >
                        {client.name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-sm text-slate-400 md:table-cell">
                      {client.company_name ?? tCommon("notAvailable")}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span dir="ltr" className="text-sm text-slate-400">
                        {client.contact_email ?? tCommon("notAvailable")}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-300">{client.reportCount}</TableCell>
                    <TableCell>
                      <Badge variant={client.is_active ? "success" : "muted"}>
                        {tStatus(client.is_active ? "active" : "inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-sm text-slate-500 sm:table-cell">
                      {formatDate(client.created_at, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-500">
        <Users className="size-5" aria-hidden />
      </span>
      <p className="text-sm text-slate-300">{title}</p>
      {hint && <p className="max-w-sm text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
