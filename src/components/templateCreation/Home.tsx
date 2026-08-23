"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bot,
  Check,
  Clock3,
  Copy,
  ListX,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Contact = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  channel: string | null;
  notes: string | null;
};
type Sender = {
  id: string;
  name: string;
  email: string;
  title: string | null;
  signature: string | null;
  is_default: boolean;
};
type Status = "draft" | "ready" | "sent" | "replied" | "no_reply" | "closed";
type Message = {
  id: string;
  contact_id: string;
  sender_id: string | null;
  subject: string;
  body: string;
  status: Status;
  last_event: string | null;
};
type Draft = {
  subject: string;
  body: string;
  rationale: string;
  warnings: string[];
  source: "ai" | "fallback";
};
const statuses: Status[] = [
  "draft",
  "ready",
  "sent",
  "replied",
  "no_reply",
  "closed",
];
const statusStyles: Record<Status, { badge: string; trigger: string; dot: string }> = {
  draft: { badge: "border-slate-400/20 bg-slate-400/10 text-slate-300", trigger: "border-slate-400/25 bg-slate-400/10 text-slate-200", dot: "bg-slate-300" },
  ready: { badge: "border-blue-400/25 bg-blue-400/10 text-blue-300", trigger: "border-blue-400/30 bg-blue-400/10 text-blue-200", dot: "bg-blue-300" },
  sent: { badge: "border-violet-400/25 bg-violet-400/10 text-violet-300", trigger: "border-violet-400/30 bg-violet-400/10 text-violet-200", dot: "bg-violet-300" },
  replied: { badge: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300", trigger: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200", dot: "bg-emerald-300" },
  no_reply: { badge: "border-amber-400/25 bg-amber-400/10 text-amber-300", trigger: "border-amber-400/30 bg-amber-400/10 text-amber-200", dot: "bg-amber-300" },
  closed: { badge: "border-slate-500/25 bg-slate-500/10 text-slate-400", trigger: "border-slate-500/30 bg-slate-500/10 text-slate-300", dot: "bg-slate-500" },
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}

function buildGmailEmailHtml(subject: string, body: string) {
  const paragraphs = body.split(/\n{2,}/).map((paragraph) => `<p style="margin:0 0 16px;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
  return `<div style="margin:0;padding:0;color:#172033;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;"><div style="max-width:640px;margin:0 auto;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#ffffff;"><div style="padding:20px 24px;border-bottom:1px solid #e5e7eb;background:#f8fafc;"><div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin-bottom:6px;">GrowthLab Outreach</div><div style="font-size:20px;line-height:1.35;font-weight:700;color:#0f172a;">${escapeHtml(subject)}</div></div><div style="padding:26px 24px 10px;">${paragraphs}</div><div style="margin:0 24px;padding:16px 0 22px;border-top:1px solid #e5e7eb;color:#64748b;font-size:12px;line-height:1.5;">Prepared with GrowthLab · Professional outreach</div></div></div>`;
}

export default function Home() {
  const t = useTranslations("adminOutreach.outreach");
  const labels: Record<Status, string> = {
    draft: t("draft"),
    ready: t("ready"),
    sent: t("sent"),
    replied: t("replied"),
    no_reply: t("noReply"),
    closed: t("closed"),
  };
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contactId, setContactId] = useState("");
  const [senderId, setSenderId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [goal, setGoal] = useState(
    "Open a thoughtful partnership conversation",
  );
  const [tone, setTone] = useState("professional");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [createKind, setCreateKind] = useState<"contact" | "sender" | null>(
    null,
  );
  const [recordName, setRecordName] = useState("");
  const [recordEmail, setRecordEmail] = useState("");
  const [recordDetail, setRecordDetail] = useState("");
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactDraft, setContactDraft] = useState({ name: "", email: "", company: "", channel: "", notes: "" });
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [messageDraft, setMessageDraft] = useState({ subject: "", body: "" });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/outreach", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setContacts(data.contacts || []);
      setSenders(data.senders || []);
      setMessages(data.messages || []);
      setContactId((current) => current || data.contacts?.[0]?.id || "");
      setSenderId((current) => current || data.senders?.[0]?.id || "");
    } catch {
      toast.error(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    void load();
  }, [load]);
  const selectedContact =
    contacts.find((item) => item.id === contactId) || null;
  const selectedSender = senders.find((item) => item.id === senderId) || null;
  const filteredContacts = useMemo(() => contacts.filter((contact) => `${contact.name} ${contact.email} ${contact.company || ""}`.toLowerCase().includes(contactSearch.toLowerCase())), [contacts, contactSearch]);
  const visibleMessages = useMemo(
    () =>
      filter === "all"
        ? messages
        : messages.filter((item) => item.status === filter),
    [filter, messages],
  );
  const counts = useMemo(
    () =>
      Object.fromEntries(
        statuses.map((status) => [
          status,
          messages.filter((item) => item.status === status).length,
        ]),
      ) as Record<Status, number>,
    [messages],
  );
  async function generate() {
    if (!selectedContact) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: selectedContact,
          sender: selectedSender,
          goal,
          tone,
          context: selectedContact.notes,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error();
      setDraft(result);
      setSubject(result.subject);
      setBody(result.body);
      if (result.source === "fallback")
        toast.warning(
          "AI was unavailable, so a safe starter draft was created. Check GEMINI_API_KEY and GEMINI_MODEL.",
        );
    } catch {
      toast.error("The draft could not be generated.");
    } finally {
      setBusy(false);
    }
  }
  async function save(status: "draft" | "ready") {
    if (!selectedContact || !subject.trim() || !body.trim())
      return toast.error(t("selectComplete"));
    setBusy(true);
    try {
      const response = await fetch("/api/admin/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "message",
          contactId,
          senderId: senderId || null,
          subject,
          body,
          goal,
          status,
        }),
      });
      if (!response.ok) throw new Error();
      toast.success(status === "ready" ? t("messageReady") : t("draftSaved"));
      await load();
    } catch {
      toast.error(t("saveError"));
    } finally {
      setBusy(false);
    }
  }
  async function updateStatus(id: string, status: Status) {
    const response = await fetch("/api/admin/outreach", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (response.ok) {
      toast.success(`Message marked ${labels[status].toLowerCase()}.`);
      await load();
    } else toast.error("Could not update the status.");
  }
  async function deleteMessage(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/outreach", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error();
      toast.success(t("deleted"));
      await load();
    } catch {
      toast.error(t("deleteError"));
    } finally {
      setBusy(false);
    }
  }
  async function clearQueue() {
    if (!messages.length || !window.confirm(t("clearQueueConfirm"))) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/outreach", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearAll: true }),
      });
      if (!response.ok) throw new Error();
      toast.success(t("queueCleared"));
      await load();
    } catch {
      toast.error(t("deleteError"));
    } finally {
      setBusy(false);
    }
  }
  async function createRecord() {
    if (!createKind || !recordName.trim() || !recordEmail.trim()) return;
    setBusy(true);
    try {
      const payload =
        createKind === "contact"
          ? {
              kind: "contact",
              name: recordName,
              email: recordEmail,
              company: recordDetail,
            }
          : {
              kind: "sender",
              name: recordName,
              email: recordEmail,
              title: recordDetail,
            };
      const response = await fetch("/api/admin/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const created = await response.json();
      if (!response.ok) throw new Error();
      createKind === "contact"
        ? setContactId(created.id)
        : setSenderId(created.id);
      setCreateKind(null);
      setRecordName("");
      setRecordEmail("");
      setRecordDetail("");
      toast.success(t("recordSaved"));
      await load();
    } catch {
      toast.error(t("recordError"));
    } finally {
      setBusy(false);
    }
  }
  function startContactEdit(contact: Contact) { setEditingContact(contact); setContactDraft({ name: contact.name, email: contact.email, company: contact.company || "", channel: contact.channel || "", notes: contact.notes || "" }); }
  async function saveContact() { if (!editingContact || !contactDraft.name.trim() || !contactDraft.email.trim()) return; setBusy(true); try { const response = await fetch("/api/admin/outreach", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "contact", id: editingContact.id, ...contactDraft }) }); if (!response.ok) throw new Error(); toast.success(t("contactUpdated")); setEditingContact(null); await load(); } catch { toast.error(t("contactUpdateError")); } finally { setBusy(false); } }
  async function deleteContact(contact: Contact) { if (!window.confirm(t("contactDeleteConfirm"))) return; setBusy(true); try { const response = await fetch("/api/admin/outreach", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "contact", id: contact.id }) }); if (!response.ok) throw new Error(); toast.success(t("contactDeleted")); if (contactId === contact.id) setContactId(""); await load(); } catch { toast.error(t("contactDeleteError")); } finally { setBusy(false); } }
  async function copyMessage(message: Message) {
    const plainText = `${message.subject}\n\n${message.body}`;
    const html = buildGmailEmailHtml(message.subject, message.body);
    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plainText], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plainText);
      }
      toast.success(t("messageCopied"));
    } catch {
      toast.error(t("copyError"));
    }
  }
  function startMessageEdit(message: Message) { setEditingMessage(message); setMessageDraft({ subject: message.subject, body: message.body }); }
  async function saveMessageEdit() { if (!editingMessage || !messageDraft.subject.trim() || !messageDraft.body.trim()) return; setBusy(true); try { const response = await fetch("/api/admin/outreach", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "message", id: editingMessage.id, ...messageDraft }) }); if (!response.ok) throw new Error(); toast.success(t("messageUpdated")); setEditingMessage(null); await load(); } catch { toast.error(t("messageUpdateError")); } finally { setBusy(false); } }

  return (
    <div className="space-y-6">
      <header className="admin-section-header flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge
            variant="outline"
            className="mb-3 border-[#81a6ff]/25 bg-[#81a6ff]/10 text-[#a9c0ff]"
          >
            {t("eyebrow")}
          </Badge>
          <h1 className="font-satoshi text-3xl text-white">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            {t("subtitle")}
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw />
          {t("refresh")}
        </Button>
      </header>
      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statuses.map((status) => (
          <Card
            key={status}
            onClick={() => setFilter(filter === status ? "all" : status)}
            className={
              filter === status
                ? "cursor-pointer border-[#81a6ff]/40 bg-[#81a6ff]/10"
                : "cursor-pointer"
            }
            size="sm"
          >
            <CardContent>
              <p className="font-satoshi text-2xl text-white">
                {counts[status] || 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {labels[status]}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {t("counts", { contacts: contacts.length, senders: senders.length })}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="ms-auto"
          onClick={() => setCreateKind("contact")}
        >
          <Plus />
          {t("newContact")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCreateKind("sender")}
        >
          <Plus />
          {t("newSender")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setContactsOpen(true)}><UserRound />Manage contacts</Button>
      </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,.9fr)]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-4 text-[#81a6ff]" />
              {t("compose")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>Recipient</FieldLabel>
                <Select
                  value={contactId}
                  onValueChange={(value) => setContactId(value || "")}
                  items={contacts.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} · {item.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Sender identity</FieldLabel>
                <Select
                  value={senderId || "growthlab"}
                  onValueChange={(value) =>
                    setSenderId(value === "growthlab" ? "" : value || "")
                  }
                  items={[
                    { value: "growthlab", label: "Use GrowthLab" },
                    ...senders.map((item) => ({
                      value: item.id,
                      label: item.name,
                    })),
                  ]}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="growthlab">Use GrowthLab</SelectItem>
                    {senders.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} · {item.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="outreach-goal">Goal</FieldLabel>
                <Input
                  id="outreach-goal"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Tone</FieldLabel>
                <Select
                  value={tone}
                  onValueChange={(value) => setTone(value || "professional")}
                  items={[
                    { value: "professional", label: "Professional" },
                    { value: "warm", label: "Warm" },
                    { value: "direct", label: "Direct" },
                  ]}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="warm">
                      Warm and conversational
                    </SelectItem>
                    <SelectItem value="direct">Direct and concise</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  onClick={() => void generate()}
                  disabled={busy || !selectedContact}
                >
                  <Bot />
                  {busy ? "Working..." : "Generate with AI"}
                </Button>
              </div>
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="outreach-subject">Subject</FieldLabel>
                <Input
                  id="outreach-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="A subject that earns attention without hype"
                />
              </Field>
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="outreach-body">Message</FieldLabel>
                <Textarea
                  id="outreach-body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={11}
                  className="resize-y"
                />
              </Field>
            </FieldGroup>
            {draft && (
              <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-xs text-amber-100">
                <p>{draft.rationale}</p>
                {draft.warnings.map((warning) => (
                  <p key={warning} className="mt-1 text-amber-200/70">
                    {warning}
                  </p>
                ))}
              </div>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setSubject("");
                  setBody("");
                  setDraft(null);
                }}
              >
                Clear
              </Button>
              <Button
                variant="outline"
                onClick={() => void save("draft")}
                disabled={busy}
              >
                Save draft
              </Button>
              <Button onClick={() => void save("ready")} disabled={busy}>
                <Check />
                Mark ready
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b border-white/[0.08]">
            <CardTitle className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <Clock3 className="size-4 shrink-0 text-[#54d8ac]" />
                <span className="truncate">Conversation queue</span>
                <Badge variant="muted" className="h-5 min-w-5 px-1.5 text-[10px] text-slate-400">
                  {messages.length}
                </Badge>
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-md border border-white/[0.08] bg-white/[0.03] text-slate-400 shadow-sm hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300"
                disabled={busy || !messages.length}
                onClick={() => void clearQueue()}
                title={t("clearQueue")}
                aria-label={t("clearQueue")}
              >
                <ListX />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-white/[0.06] px-0">
            {loading ? (
              <p className="px-6 py-8 text-sm text-muted-foreground">
                Loading outreach records...
              </p>
            ) : visibleMessages.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                No messages in this view.
              </p>
            ) : (
              visibleMessages.map((message) => {
                const contact = contacts.find(
                  (item) => item.id === message.contact_id,
                );
                return (
                  <article key={message.id} className="group space-y-3 px-6 py-4 transition-colors hover:bg-white/[0.025]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {message.subject}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <UserRound className="size-3" />
                          {contact?.name || "Unknown contact"} ·{" "}
                          {contact?.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2"><Badge variant="outline" className={statusStyles[message.status].badge}>
                        <span className={`size-1.5 rounded-full ${statusStyles[message.status].dot}`} />
                        {labels[message.status]}
                      </Badge><Button variant="ghost" size="icon-sm" className="text-slate-500 opacity-60 hover:bg-cyan-400/10 hover:text-cyan-200 group-hover:opacity-100" title={t("copyMessage")} aria-label={t("copyMessage")} onClick={() => void copyMessage(message)}><Copy /></Button><Button variant="ghost" size="icon-sm" className="text-slate-500 opacity-60 hover:bg-blue-400/10 hover:text-blue-200 group-hover:opacity-100" title={t("editMessage")} aria-label={t("editMessage")} onClick={() => startMessageEdit(message)}><Pencil /></Button><Button variant="ghost" size="icon-sm" className="border border-transparent text-slate-500 opacity-60 transition-all hover:border-red-400/20 hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100" title={t("delete")} aria-label={t("delete")} disabled={busy} onClick={() => void deleteMessage(message.id)}><Trash2 /></Button></div>
                    </div>
                    <p className="line-clamp-2 text-xs leading-5 text-slate-400">
                      {message.body}
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] text-slate-600">
                        {message.last_event || "Created"}
                      </p>
                      <Select
                        value={message.status}
                        onValueChange={(value) =>
                          value &&
                          void updateStatus(message.id, value as Status)
                        }
                        items={statuses.map((status) => ({
                          value: status,
                          label: labels[status],
                        }))}
                      >
                        <SelectTrigger className={`h-8 w-32 border ${statusStyles[message.status].trigger}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((status) => (
                            <SelectItem key={status} value={status} className={statusStyles[status].badge}>
                              <span className={`size-1.5 rounded-full ${statusStyles[status].dot}`} />
                              {labels[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </article>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog
        open={Boolean(createKind)}
        onOpenChange={(open) => !open && setCreateKind(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New {createKind}</DialogTitle>
            <DialogDescription>
              Save this record once and reuse it across future outreach.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="record-name">Name</FieldLabel>
              <Input
                id="record-name"
                value={recordName}
                onChange={(event) => setRecordName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="record-email">Email</FieldLabel>
              <Input
                id="record-email"
                type="email"
                dir="ltr"
                value={recordEmail}
                onChange={(event) => setRecordEmail(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="record-detail">
                {createKind === "contact" ? "Company" : "Title"}
              </FieldLabel>
              <Input
                id="record-detail"
                value={recordDetail}
                onChange={(event) => setRecordDetail(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateKind(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void createRecord()}
              disabled={busy || !recordName.trim() || !recordEmail.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={contactsOpen} onOpenChange={setContactsOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle className="flex items-center gap-2"><UserRound className="size-5 text-cyan-300" />{t("contactsTitle")}</SheetTitle><SheetDescription>{t("contactsDescription")}</SheetDescription></SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <div className="relative"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder={t("searchContacts")} className="h-10 rounded-xl border-white/[0.12] bg-black/20 ps-9" /></div>
            <div className="space-y-2">{filteredContacts.map((contact) => <div key={contact.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{contact.name}</p><p className="truncate text-xs text-slate-400">{contact.email}</p>{contact.company && <p className="mt-1 text-[11px] text-slate-500">{contact.company}</p>}</div><div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon-sm" onClick={() => startContactEdit(contact)} aria-label={t("editContact")}><Pencil /></Button><Button variant="ghost" size="icon-sm" className="text-slate-500 hover:text-red-300" disabled={busy} onClick={() => void deleteContact(contact)} aria-label={t("deleteContact")}><Trash2 /></Button></div></div></div>)}{!filteredContacts.length && <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">{t("noContacts")}</p>}</div>
          </div>
        </SheetContent>
      </Sheet>
      <Dialog open={Boolean(editingContact)} onOpenChange={(open) => !open && setEditingContact(null)}><DialogContent><DialogHeader><DialogTitle>{t("editContact")}</DialogTitle><DialogDescription>{t("editContactDescription")}</DialogDescription></DialogHeader><FieldGroup><Field><FieldLabel>Name</FieldLabel><Input value={contactDraft.name} onChange={(e) => setContactDraft((d) => ({ ...d, name: e.target.value }))} /></Field><Field><FieldLabel>Email</FieldLabel><Input type="email" value={contactDraft.email} onChange={(e) => setContactDraft((d) => ({ ...d, email: e.target.value }))} /></Field><Field><FieldLabel>Company</FieldLabel><Input value={contactDraft.company} onChange={(e) => setContactDraft((d) => ({ ...d, company: e.target.value }))} /></Field><Field><FieldLabel>Channel</FieldLabel><Input value={contactDraft.channel} onChange={(e) => setContactDraft((d) => ({ ...d, channel: e.target.value }))} /></Field><Field><FieldLabel>Notes</FieldLabel><Textarea rows={3} value={contactDraft.notes} onChange={(e) => setContactDraft((d) => ({ ...d, notes: e.target.value }))} /></Field></FieldGroup><DialogFooter><Button variant="outline" onClick={() => setEditingContact(null)}>Cancel</Button><Button onClick={() => void saveContact()} disabled={busy || !contactDraft.name.trim() || !contactDraft.email.trim()}>Save changes</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={Boolean(editingMessage)} onOpenChange={(open) => !open && setEditingMessage(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{t("editMessage")}</DialogTitle><DialogDescription>{t("editMessageDescription")}</DialogDescription></DialogHeader><FieldGroup className="gap-4"><Field><FieldLabel>{t("subject")}</FieldLabel><Input value={messageDraft.subject} onChange={(e) => setMessageDraft((draft) => ({ ...draft, subject: e.target.value }))} /></Field><Field><FieldLabel>{t("message")}</FieldLabel><Textarea rows={12} className="resize-y" value={messageDraft.body} onChange={(e) => setMessageDraft((draft) => ({ ...draft, body: e.target.value }))} /></Field></FieldGroup><DialogFooter><Button variant="outline" onClick={() => setEditingMessage(null)}>{t("cancel")}</Button><Button onClick={() => void saveMessageEdit()} disabled={busy || !messageDraft.subject.trim() || messageDraft.body.trim().length < 10}>{t("saveChanges")}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
