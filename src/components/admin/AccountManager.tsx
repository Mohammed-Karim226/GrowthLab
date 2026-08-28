"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { Check, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiRequestError, apiDelete, apiPatch, apiPost } from "@/lib/api-client";
import { PLATFORMS, type AccountRow, type Platform } from "@/types/database";

export default function AccountManager({ clientId, accounts }: { clientId: string; accounts: AccountRow[] }) {
  const t = useTranslations("admin.accounts");
  const tPlatforms = useTranslations("platforms");
  const tErrors = useTranslations("admin.errors");
  const router = useRouter();
  const [rows, setRows] = useState(accounts);
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [pageName, setPageName] = useState("");
  const [pageId, setPageId] = useState("");
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [editPlatform, setEditPlatform] = useState<Platform>("facebook");
  const [editPageName, setEditPageName] = useState("");
  const [editPageId, setEditPageId] = useState("");
  const [editStage, setEditStage] = useState("");

  const reportError = (error: unknown) => toast.error(tErrors((error instanceof ApiRequestError ? error.errorKey : "serverError") as never));
  const create = useMutation({
    mutationFn: () => apiPost<{ account: AccountRow }>(`/api/admin/clients/${clientId}/accounts`, { platform, pageName, pageId }),
    onSuccess: ({ account }) => { setRows((current) => [...current, account]); setPageName(""); setPageId(""); toast.success(t("created")); router.refresh(); },
    onError: reportError,
  });
  const update = useMutation({
    mutationFn: () => apiPatch<{ account: AccountRow }>(`/api/admin/accounts/${editing?.id}`, { platform: editPlatform, pageName: editPageName, pageId: editPageId || null, stage: editStage || null }),
    onSuccess: ({ account }) => { setRows((current) => current.map((row) => row.id === account.id ? account : row)); setEditing(null); toast.success(t("updated")); router.refresh(); },
    onError: reportError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: string }>(`/api/admin/accounts/${id}`),
    onSuccess: (_, id) => { setRows((current) => current.filter((row) => row.id !== id)); toast.success(t("deleted")); router.refresh(); },
    onError: reportError,
  });
  const startEdit = (account: AccountRow) => { setEditing(account); setEditPlatform(account.platform); setEditPageName(account.page_name ?? ""); setEditPageId(account.page_id ?? ""); setEditStage(account.stage ?? ""); };

  const platformSelect = (value: Platform, onChange: (value: Platform) => void) => <Select value={value} onValueChange={(next) => next && onChange(next as Platform)} items={PLATFORMS.map((item) => ({ value: item, label: tPlatforms(item) }))}><SelectTrigger aria-label={t("platform")}><SelectValue /></SelectTrigger><SelectContent>{PLATFORMS.map((item) => <SelectItem key={item} value={item}>{tPlatforms(item)}</SelectItem>)}</SelectContent></Select>;

  return <Card className="liquid-card border-white/[0.06] bg-white/[0.02]"><CardHeader><CardTitle className="text-sm text-white">{t("title")}</CardTitle></CardHeader><CardContent className="space-y-4">
    <div className="grid gap-2">{platformSelect(platform, setPlatform)}<Input value={pageName} onChange={(e) => setPageName(e.target.value)} placeholder={t("namePlaceholder")} /><Input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder={t("idPlaceholder")} /><Button disabled={!pageName.trim() || create.isPending} onClick={() => create.mutate()}>{create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}{t("add")}</Button></div>
    {rows.length === 0 ? <p className="text-xs text-slate-500">{t("empty")}</p> : <ul className="space-y-2">{rows.map((account) => <li key={account.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm text-slate-200">{account.page_name}</p><p className="text-[11px] text-slate-500">{tPlatforms(account.platform)}{account.page_id ? ` · ${account.page_id}` : ""}{account.stage ? ` · ${account.stage}` : ""}</p></div><Button size="icon-sm" variant="ghost" onClick={() => startEdit(account)} aria-label={t("edit")}><Pencil /></Button><Button size="icon-sm" variant="ghost" disabled={remove.isPending} onClick={() => { if (window.confirm(t("deleteConfirm"))) remove.mutate(account.id); }} aria-label={t("delete")}><Trash2 /></Button></li>)}</ul>}
    <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}><DialogContent className="vip-dialog"><DialogHeader><DialogTitle>{t("editTitle")}</DialogTitle><DialogDescription>{t("editHint")}</DialogDescription></DialogHeader><div className="grid gap-3">{platformSelect(editPlatform, setEditPlatform)}<Input value={editPageName} onChange={(e) => setEditPageName(e.target.value)} placeholder={t("namePlaceholder")} /><Input value={editPageId} onChange={(e) => setEditPageId(e.target.value)} placeholder={t("idPlaceholder")} /><Input value={editStage} onChange={(e) => setEditStage(e.target.value)} placeholder={t("stagePlaceholder")} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)}>{t("cancel")}</Button><Button type="button" disabled={!editPageName.trim() || update.isPending} onClick={() => update.mutate()}>{update.isPending ? <Loader2 className="animate-spin" /> : <Check />}{t("save")}</Button></DialogFooter></DialogContent></Dialog>
  </CardContent></Card>;
}
