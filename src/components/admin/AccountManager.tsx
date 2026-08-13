"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiRequestError, apiDelete, apiPost } from "@/lib/api-client";
import { PLATFORMS, type AccountRow, type Platform } from "@/types/database";

export default function AccountManager({ clientId, accounts }: { clientId: string; accounts: AccountRow[] }) {
  const t = useTranslations("admin.accounts");
  const tPlatforms = useTranslations("platforms");
  const tErrors = useTranslations("admin.errors");
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [pageName, setPageName] = useState("");
  const [pageId, setPageId] = useState("");

  const reportError = (error: unknown) => toast.error(tErrors((error instanceof ApiRequestError ? error.errorKey : "serverError") as never));
  const create = useMutation({
    mutationFn: () => apiPost<{ account: AccountRow }>(`/api/admin/clients/${clientId}/accounts`, { platform, pageName, pageId }),
    onSuccess: () => { setPageName(""); setPageId(""); toast.success(t("created")); router.refresh(); },
    onError: reportError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: string }>(`/api/admin/accounts/${id}`),
    onSuccess: () => { toast.success(t("deleted")); router.refresh(); },
    onError: reportError,
  });

  return <Card className="liquid-card border-white/[0.06] bg-white/[0.02]">
    <CardHeader><CardTitle className="text-sm text-white">{t("title")}</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-2">
        <Select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} aria-label={t("platform")}>
          {PLATFORMS.map((value) => <option key={value} value={value}>{tPlatforms(value)}</option>)}
        </Select>
        <Input value={pageName} onChange={(e) => setPageName(e.target.value)} placeholder={t("namePlaceholder")} />
        <Input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder={t("idPlaceholder")} />
        <Button disabled={!pageName.trim() || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}{t("add")}
        </Button>
      </div>
      {accounts.length === 0 ? <p className="text-xs text-slate-500">{t("empty")}</p> : <ul className="space-y-2">
        {accounts.map((account) => <li key={account.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="min-w-0 flex-1"><p className="truncate text-sm text-slate-200">{account.page_name}</p><p className="text-[11px] text-slate-500">{tPlatforms(account.platform)}{account.page_id ? ` · ${account.page_id}` : ""}</p></div>
          <Button size="icon-sm" variant="ghost" disabled={remove.isPending} onClick={() => { if (window.confirm(t("deleteConfirm"))) remove.mutate(account.id); }} aria-label={t("delete")}><Trash2 /></Button>
        </li>)}
      </ul>}
    </CardContent>
  </Card>;
}
