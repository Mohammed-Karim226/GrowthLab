"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiRequestError, apiDelete, apiPatch, apiPost } from "@/lib/api-client";
import GmailPasswordRevealDialog from "@/components/admin/GmailPasswordRevealDialog";
import type { ClientGmailRow } from "@/types/database";

const RELATED_FIELDS = [
  { name: "service", label: "servicePlaceholder" },
  { name: "username", label: "usernamePlaceholder" },
  { name: "password", label: "passwordPlaceholder" },
] as const;

export default function GmailCredentialManager({ clientId, initial }: { clientId: string; initial: ClientGmailRow[] }) {
  const t = useTranslations("auth.gmail");
  const tErrors = useTranslations("admin.errors");
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<ClientGmailRow | null>(null);
  const [revealing, setRevealing] = useState<ClientGmailRow | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  // Replacement fields start empty; saved passwords are viewed in a separate dialog.
  const [password, setPassword] = useState("");
  const [related, setRelated] = useState<Array<{ id: string; service: string; username: string; password: string }>>([]);
  // Errors arrive as a translation key, so a 409 and a 503 no longer read alike.
  const reportError = (cause: unknown) =>
    toast.error(tErrors((cause instanceof ApiRequestError ? cause.errorKey : "serverError") as never));
  function close() { setPassword(""); setRelated([]); setEditing(null); setOpen(false); }
  function start(row: ClientGmailRow | null) {
    setEditing(row); setEmail(row?.email ?? ""); setPassword("");
    setRelated((row?.services ?? []).map((s) => ({ id: s.id, service: s.service, username: s.username, password: "" })));
    setOpen(true);
  }
  async function save() {
    setBusy(true);
    try {
      const input = { email, password, relatedAccounts: related };
      const { account } = editing
        ? await apiPatch<{ account: ClientGmailRow }>(`/api/admin/gmail-accounts/${editing.id}`, input)
        : await apiPost<{ account: ClientGmailRow }>(`/api/admin/clients/${clientId}/gmail-accounts`, input);
      setRows((current) => editing ? current.map((r) => r.id === account.id ? account : r) : [...current, account]);
      const created = !editing;
      close(); router.refresh(); toast.success(t(created ? "created" : "updated"));
    } catch (cause) { reportError(cause); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true);
    try {
      await apiDelete(`/api/admin/gmail-accounts/${id}`);
      setRows((current) => current.filter((r) => r.id !== id));
      router.refresh(); toast.success(t("deleted"));
    } catch (cause) { reportError(cause); }
    finally { setBusy(false); }
  }
  return <Card>
    <CardHeader><CardTitle>{t("title")}</CardTitle><p>{t("vaultHint")}</p></CardHeader>
    <CardContent className="space-y-3">
      <Button onClick={() => start(null)}>{t("add")}</Button>
      {rows.length === 0 && <p>{t("empty")}</p>}
      {rows.map((row) => <div key={row.id} className="space-y-2 rounded border p-3">
        <p dir="ltr">{row.email}</p><p>{t(row.has_secret ? "configured" : "rotationRequired")}</p>
        {row.services.map((service) => <p key={service.id}>{service.service} / {service.username}</p>)}
        <Button disabled={busy || !row.has_secret} variant="outline" onClick={() => setRevealing(row)}>{t("showPasswords")}</Button>
        <Button disabled={busy} onClick={() => start(row)}>{t("replace")}</Button>
        <Button disabled={busy} variant="outline" onClick={() => { if (window.confirm(t("deleteConfirm"))) void remove(row.id); }}>{t("delete")}</Button>
      </div>)}
      {revealing && <GmailPasswordRevealDialog key={revealing.id} account={revealing} onClose={() => setRevealing(null)} />}
      <Dialog open={open} onOpenChange={(value) => { if (!value) close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(editing ? "replaceTitle" : "addTitle")}</DialogTitle>
            <DialogDescription>{t("replacementHint")}</DialogDescription>
          </DialogHeader>
          <Input aria-label={t("emailPlaceholder")} placeholder={t("emailPlaceholder")} dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input aria-label={t("passwordPlaceholder")} placeholder={t("passwordPlaceholder")} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p>{t("related")}</p>
          {related.map((item, index) => <div key={item.id} className="grid gap-2">
            {RELATED_FIELDS.map(({ name, label }) => <Input key={name} aria-label={t(label)} placeholder={t(label)} type={name === "password" ? "password" : "text"} autoComplete={name === "password" ? "new-password" : undefined} value={item[name]} onChange={(e) => setRelated((current) => current.map((r, i) => i === index ? { ...r, [name]: e.target.value } : r))} />)}
            <Button variant="outline" onClick={() => setRelated((current) => current.filter((_, i) => i !== index))}>{t("removeRelated")}</Button>
          </div>)}
          <Button disabled={related.length >= 20} onClick={() => setRelated((current) => [...current, { id: crypto.randomUUID(), service: "", username: "", password: "" }])}>{t("addRelated")}</Button>
          <Button disabled={busy || !email || !password || related.some((r) => !r.service || !r.username || !r.password)} onClick={() => void save()}>{t(busy ? "saving" : "save")}</Button>
          <Button variant="outline" disabled={busy} onClick={close}>{t("cancel")}</Button>
        </DialogContent>
      </Dialog>
    </CardContent>
  </Card>;
}
