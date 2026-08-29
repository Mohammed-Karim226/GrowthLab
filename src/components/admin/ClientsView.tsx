"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Check,
  Crown,
  Loader2,
  Pause,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

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
import PaginationNav from "@/components/ui/PaginationNav";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiRequestError, apiDelete, apiPatch } from "@/lib/api-client";

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
  query,
  previousHref,
  nextHref,
  currentPage,
  totalClients,
  pageSize,
}: {
  clients: ClientListItem[];
  locale: Locale;
  query: string;
  previousHref: string | null;
  nextHref: string | null;
  currentPage: number;
  totalClients: number;
  pageSize: number;
}) {
  const t = useTranslations("admin.clients");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("status");
  const router = useRouter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState<{
    client: ClientListItem;
    action: "active" | "paused" | "delete";
  } | null>(null);
  const action = useMutation({
    mutationFn: ({
      client,
      kind,
    }: {
      client: ClientListItem;
      kind: "active" | "paused" | "delete";
    }) =>
      kind === "delete"
        ? apiDelete<{ deleted: string }>(`/api/admin/clients/${client.id}`)
        : apiPatch(`/api/admin/clients/${client.id}`, {
            isActive: kind === "active",
          }),
    onSuccess: () => {
      setPending(null);
      toast.success(t("actionSuccess"));
      router.refresh();
    },
    onError: (error) =>
      toast.error(
        t("actionError", {
          error:
            error instanceof ApiRequestError ? error.errorKey : "serverError",
        }),
      ),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form
          method="get"
          action={`/${locale}/admin/clients`}
          className="admin-search relative flex w-full max-w-sm gap-2"
        >
          <Search
            aria-hidden
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
          />
          <Input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={t("searchPlaceholder")}
            aria-label={tCommon("search")}
            className="border-white/10 bg-white/[0.02] ps-9 text-slate-200"
          />
          <Button type="submit" variant="outline" size="sm">
            {tCommon("search")}
          </Button>
        </form>

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
            <EmptyState
              title={query ? t("noMatches") : t("empty")}
              hint={query ? undefined : t("emptyHint")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.06] hover:bg-transparent">
                  <TableHead>{t("columns.name")}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t("columns.company")}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t("columns.email")}
                  </TableHead>
                  <TableHead>{t("columns.reports")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    {t("columns.created")}
                  </TableHead>
                  <TableHead className="text-end">
                    {t("columns.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow
                    key={client.id}
                    className="border-white/[0.06] hover:bg-white/[0.03]"
                  >
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
                    <TableCell className="text-sm text-slate-300">
                      {client.reportCount}
                    </TableCell>
                    <TableCell>
                      <Badge variant={client.is_active ? "success" : "muted"}>
                        {client.is_active
                          ? tStatus("active")
                          : t("actions.paused")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-sm text-slate-500 sm:table-cell">
                      {formatDate(client.created_at, locale)}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title={t("actions.active")}
                          aria-label={t("actions.active")}
                          disabled={action.isPending || client.is_active}
                          onClick={() =>
                            setPending({ client, action: "active" })
                          }
                        >
                          <Check />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title={t("actions.paused")}
                          aria-label={t("actions.paused")}
                          disabled={action.isPending || !client.is_active}
                          onClick={() =>
                            setPending({ client, action: "paused" })
                          }
                        >
                          <Pause />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="destructive"
                          title={t("actions.delete")}
                          aria-label={t("actions.delete")}
                          disabled={action.isPending}
                          onClick={() =>
                            setPending({ client, action: "delete" })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PaginationNav
        previousHref={previousHref}
        nextHref={nextHref}
        previousLabel={tCommon("previous")}
        nextLabel={tCommon("next")}
        statusLabel={t("pagination", { page: currentPage, pages: Math.max(1, Math.ceil(totalClients / pageSize)), total: totalClients })}
      />

      <CreateClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => router.refresh()}
      />

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => !open && !action.isPending && setPending(null)}
      >
        <DialogContent className="vip-dialog max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pending ? t(`confirm.${pending.action}.title`) : ""}
            </DialogTitle>
            <DialogDescription>
              {pending
                ? t(`confirm.${pending.action}.description`, {
                    name: pending.client.name,
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() => setPending(null)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant={pending?.action === "delete" ? "destructive" : "default"}
              disabled={action.isPending}
              onClick={() =>
                pending &&
                action.mutate({ client: pending.client, kind: pending.action })
              }
            >
              {action.isPending && <Loader2 className="animate-spin" />}
              {t("confirmButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
