"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiDelete, apiPatch, apiPost } from "@/lib/api-client";
import type { ClientGmailRow } from "@/types/database";

export default function GmailCredentialManager({ clientId, initial }: { clientId: string; initial: ClientGmailRow[] }) {
  const t = useTranslations("auth.gmail");
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<ClientGmailRow | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  // Only newly entered secrets ever exist in form state; saved values are never loaded.
  const [password, setPassword] = useState("");
  const [related, setRelated] = useState<Array<{ id: string; service: string; username: string; password: string }>>([]);
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
      close(); router.refresh(); toast.success(t("updated"));
    } catch { toast.error(t("error")); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true);
    try { await apiDelete(`/api/admin/gmail-accounts/${id}`); setRows((current) => current.filter((r) => r.id !== id)); }
    catch { toast.error(t("error")); }
    finally { setBusy(false); }
  }
  return <Card>
    <CardHeader><CardTitle>{t("title")}</CardTitle><p>{t("writeOnlyHint")}</p></CardHeader>
    <CardContent className="space-y-3">
      <Button onClick={() => start(null)}>{t("add")}</Button>
      {rows.map((row) => <div key={row.id} className="space-y-2 rounded border p-3">
        <p dir="ltr">{row.email}</p><p>{t(row.has_secret ? "configured" : "rotationRequired")}</p>
        {row.services.map((service) => <p key={service.id}>{service.service} / {service.username}</p>)}
        <Button disabled={busy} onClick={() => start(row)}>{t("replace")}</Button>
        <Button disabled={busy} variant="outline" onClick={() => { if (window.confirm(t("deleteConfirm"))) void remove(row.id); }}>{t("delete")}</Button>
      </div>)}
      <Dialog open={open} onOpenChange={(value) => { if (!value) close(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("replace")}</DialogTitle><DialogDescription>{t("replacementHint")}</DialogDescription></DialogHeader>
          <Input aria-label={t("emailPlaceholder")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input aria-label={t("passwordPlaceholder")} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {related.map((item, index) => <div key={item.id} className="grid gap-2">
            {(["service", "username", "password"] as const).map((field) => <Input key={field} aria-label={field} type={field === "password" ? "password" : "text"} value={item[field]} onChange={(e) => setRelated((current) => current.map((r, i) => i === index ? { ...r, [field]: e.target.value } : r))} />)}
            <Button variant="outline" onClick={() => setRelated((current) => current.filter((_, i) => i !== index))}>{t("removeRelated")}</Button>
          </div>)}
          <Button disabled={related.length >= 20} onClick={() => setRelated((current) => [...current, { id: crypto.randomUUID(), service: "", username: "", password: "" }])}>{t("addRelated")}</Button>
          <Button disabled={busy || !email || !password || related.some((r) => !r.service || !r.username || !r.password)} onClick={() => void save()}>{t("save")}</Button>
        </DialogContent>
      </Dialog>
    </CardContent>
  </Card>;
}
