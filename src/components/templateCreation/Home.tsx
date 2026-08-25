"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bot,
  Check,
  Clock3,
  Copy,
  Globe2,
  ListX,
  Mail,
  MessageCircle,
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
type CopyLanguage = "en" | "ar";
const DEFAULT_OUTREACH_WEBSITE = "https://growth-lab-lac.vercel.app/ar";
const LEGACY_OUTREACH_WEBSITE = "https://growthlab.agency";
const DEFAULT_OUTREACH_WHATSAPP = "201126421602";
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

function buildGmailEmailHtml(subject: string, body: string, contact?: Contact, sender?: Sender, language: CopyLanguage = "en", website = "", whatsapp = "") {
  const copyLabels = language === "ar"
    ? { eyebrow: "GrowthLab - رسالة خاصة للعميل", prepared: "أُعدت خصيصًا لـ", badge: "موجز VIP", note: "رسالة شخصية لك", connect: "تواصل معنا مباشرة", website: "زيارة موقعنا", whatsapp: "تواصل عبر واتساب", footer: "هذه رسالة خاصة أُعدت لك. يمكنك الرد مباشرة عندما تكون مستعدًا للمتابعة." }
    : { eyebrow: "GrowthLab - Private Client Note", prepared: "Prepared especially for", badge: "VIP BRIEF", note: "A personal note for you", connect: "Connect with us directly", website: "Visit our website", whatsapp: "Chat on WhatsApp", footer: "A private communication prepared for you. Reply directly whenever you are ready to continue." };
  const recipient = escapeHtml(contact?.name || "Valued Partner");
  const company = contact?.company ? ` - ${escapeHtml(contact.company)}` : "";
  const senderName = escapeHtml(sender?.name || "GrowthLab Team");
  const senderTitle = sender?.title ? `<div style="margin-top:4px;color:#64748b;font-size:12px;line-height:1.5;">${escapeHtml(sender.title)}</div>` : "";
  const senderEmail = sender?.email ? `<div style="margin-top:3px;color:#4d7c8a;font-size:12px;line-height:1.5;">${escapeHtml(sender.email)}</div>` : "";
  const vipParagraphs = body.split(/\n{2,}/).map((paragraph) => `<p style="margin:0 0 19px;color:#26364a;font-size:16px;font-weight:500;line-height:${language === "ar" ? "1.9" : "1.78"};">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
  const direction = language === "ar" ? "rtl" : "ltr";
  const font = language === "ar" ? "Tahoma,Arial,sans-serif" : "Arial,Helvetica,sans-serif";
  const glassLabel = (text: string) => `<span style="display:inline-block;padding:7px 12px;border:1px solid rgba(202,155,43,.48);border-radius:999px;background:linear-gradient(135deg,rgba(255,251,229,.96),rgba(247,224,145,.48));color:#8f6916;font-size:10px;font-weight:800;letter-spacing:1.25px;line-height:1.2;text-transform:uppercase;box-shadow:inset 0 1px 2px rgba(255,255,255,.98),0 3px 10px rgba(184,135,24,.14);">${text}</span>`;
  const vipBadge = glassLabel(copyLabels.badge);
  const websiteUrl = website.trim() ? (/^https?:\/\//i.test(website.trim()) ? website.trim() : `https://${website.trim()}`) : "";
  const whatsappNumber = whatsapp.replace(/\D/g, "");
  const contactButtons = `${websiteUrl ? `<tr><td style="padding:0 0 12px;"><a href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener noreferrer" style="display:block;padding:8px 10px;border:1px solid rgba(255,255,255,.72);border-radius:16px;background:#D8D8D8;color:#25292d;text-decoration:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),inset 0 -1px 0 rgba(94,98,102,.12),0 8px 20px rgba(51,55,59,.13);"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="42" style="width:42px;"><span style="display:block;width:34px;height:34px;border:1px solid rgba(255,255,255,.78);border-radius:11px;background:rgba(255,255,255,.42);color:#343a3f;font-size:16px;line-height:32px;text-align:center;">&#8599;</span></td><td align="${language === "ar" ? "right" : "left"}" style="padding:0 10px;font-size:14px;font-weight:800;letter-spacing:.1px;line-height:1.25;">${copyLabels.website}<div style="margin-top:3px;color:#62686d;font-size:10px;font-weight:600;letter-spacing:.4px;">${language === "ar" ? "رابط آمن ومباشر" : "Secure direct link"}</div></td><td width="32" align="right" style="width:32px;color:#4a5055;font-size:19px;font-weight:400;">&#8594;</td></tr></table></a></td></tr>` : ""}${whatsappNumber ? `<tr><td style="padding:0;"><a href="https://wa.me/${whatsappNumber}" target="_blank" rel="noopener noreferrer" style="display:block;padding:8px 10px;border:1px solid rgba(255,255,255,.58);border-radius:16px;background:#A3A9A4;color:#17201a;text-decoration:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.7),inset 0 -1px 0 rgba(56,70,61,.16),0 8px 20px rgba(41,52,44,.15);"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="42" style="width:42px;"><span style="display:block;width:34px;height:34px;border:1px solid rgba(255,255,255,.62);border-radius:11px;background:rgba(255,255,255,.3);color:#26362c;font-size:16px;line-height:32px;text-align:center;">&#9993;</span></td><td align="${language === "ar" ? "right" : "left"}" style="padding:0 10px;font-size:14px;font-weight:800;letter-spacing:.1px;line-height:1.25;">${copyLabels.whatsapp}<div style="margin-top:3px;color:#526158;font-size:10px;font-weight:600;letter-spacing:.4px;">${language === "ar" ? "محادثة مباشرة وسريعة" : "Fast direct conversation"}</div></td><td width="32" align="right" style="width:32px;color:#34463a;font-size:19px;font-weight:400;">&#8594;</td></tr></table></a></td></tr>` : ""}`;
  const contactSection = contactButtons ? `<tr><td style="padding:10px 22px 26px;"><div style="margin-bottom:12px;">${glassLabel(copyLabels.connect)}</div><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${contactButtons}</table></td></tr>` : "";
  return `<table dir="${direction}" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:0;background:#edf4ff;font-family:${font};color:#26364a;"><tr><td align="center" style="padding:18px 10px;background:#edf4ff;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #d8e5f2;border-radius:22px;overflow:hidden;box-shadow:0 12px 32px rgba(74,107,143,.14);"><tr><td style="padding:12px 22px;background:#e8f7f5;">${glassLabel(copyLabels.eyebrow)}</td></tr><tr><td style="padding:22px;background:#dcecff;background:linear-gradient(135deg,#dcecff 0%,#f2e8ff 52%,#e2f8f2 100%);">${vipBadge}<div style="margin-top:18px;">${glassLabel(copyLabels.prepared)}</div><div style="margin-top:10px;color:#213b59;font-size:26px;font-weight:800;line-height:1.25;word-break:break-word;">${recipient}${company}</div></td></tr><tr><td style="padding:24px 22px 4px;">${glassLabel(copyLabels.note)}<h1 style="margin:12px 0 0;color:#213b59;font-size:24px;line-height:1.35;font-weight:800;word-break:break-word;">${escapeHtml(subject)}</h1><div style="margin-top:16px;width:46px;height:4px;border-radius:4px;background:#f2a7b8;"></div></td></tr><tr><td style="padding:22px 22px 4px;">${vipParagraphs}</td></tr>${contactSection}<tr><td style="padding:8px 22px 24px;border-top:1px solid #e3ebf3;"><div style="padding-top:18px;color:#213b59;font-size:15px;font-weight:800;">${senderName}</div>${senderTitle}${senderEmail}<div style="margin-top:12px;color:#5d6eae;font-size:10px;font-weight:800;letter-spacing:1px;">GROWTHLAB</div></td></tr><tr><td style="padding:14px 22px;background:#f5f9fc;border-top:1px solid #e3ebf3;color:#718096;font-size:10px;line-height:1.6;">${copyLabels.footer}</td></tr></table></td></tr></table>`;
}

function buildSimpleGmailEmailHtml(subject: string, body: string, contact?: Contact, sender?: Sender, language: CopyLanguage = "en", website = "", whatsapp = "") {
  const labels = language === "ar"
    ? { greeting: "مرحبًا", website: "زيارة الموقع", whatsapp: "تواصل عبر واتساب", footer: "يمكنك الرد مباشرة على هذه الرسالة في أي وقت." }
    : { greeting: "Hello", website: "Visit our website", whatsapp: "Chat on WhatsApp", footer: "You can reply directly to this message at any time." };
  const direction = language === "ar" ? "rtl" : "ltr";
  const alignment = language === "ar" ? "right" : "left";
  const font = language === "ar" ? "Tahoma,Arial,sans-serif" : "Arial,Helvetica,sans-serif";
  const recipient = escapeHtml(contact?.name || (language === "ar" ? "عميلنا العزيز" : "Valued client"));
  const company = contact?.company ? `<div style="margin-top:4px;color:#00838F;font-size:13px;line-height:1.5;opacity:.75;">${escapeHtml(contact.company)}</div>` : "";
  const senderName = escapeHtml(sender?.name || "GrowthLab Team");
  const senderTitle = sender?.title ? `<div style="margin-top:3px;font-size:13px;line-height:1.5;opacity:.75;">${escapeHtml(sender.title)}</div>` : "";
  const senderEmail = sender?.email ? `<div style="margin-top:3px;font-size:13px;line-height:1.5;opacity:.75;">${escapeHtml(sender.email)}</div>` : "";
  const paragraphs = body.split(/\n{2,}/).map((paragraph) => `<p style="margin:0 0 18px;color:#00838F;font-size:16px;line-height:${language === "ar" ? "1.9" : "1.7"};">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
  const websiteUrl = website.trim() ? (/^https?:\/\//i.test(website.trim()) ? website.trim() : `https://${website.trim()}`) : "";
  const whatsappNumber = whatsapp.replace(/\D/g, "");
  const button = (href: string, label: string) => `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="display:block;padding:14px 18px;border:1px solid #00838F;border-radius:10px;background:#F5F5F5;color:#00838F;font-size:15px;font-weight:700;line-height:1.2;text-align:center;text-decoration:none;">${label}&nbsp;&nbsp;&#8594;</a>`;
  const actions = [
    websiteUrl ? `<td style="padding:0 6px 10px;">${button(websiteUrl, labels.website)}</td>` : "",
    whatsappNumber ? `<td style="padding:0 6px 10px;">${button(`https://wa.me/${whatsappNumber}`, labels.whatsapp)}</td>` : "",
  ].filter(Boolean).join("");
  const actionSection = actions ? `<tr><td style="padding:6px 18px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${actions}</tr></table></td></tr>` : "";

  return `<table dir="${direction}" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:0;background:#F5F5F5;font-family:${font};color:#00838F;"><tr><td align="center" style="padding:16px 8px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="width:100%;max-width:620px;background:#F5F5F5;border:1px solid #00838F;border-radius:12px;overflow:hidden;"><tr><td align="${alignment}" style="padding:24px 24px 18px;border-bottom:1px solid rgba(0,131,143,.22);"><div style="font-size:14px;font-weight:700;line-height:1.5;">${labels.greeting} ${recipient},</div>${company}<h1 style="margin:18px 0 0;color:#00838F;font-size:25px;font-weight:700;line-height:1.35;word-break:break-word;">${escapeHtml(subject)}</h1></td></tr><tr><td align="${alignment}" style="padding:24px 24px 8px;">${paragraphs}</td></tr>${actionSection}<tr><td align="${alignment}" style="padding:20px 24px;border-top:1px solid rgba(0,131,143,.22);color:#00838F;"><div style="font-size:15px;font-weight:700;line-height:1.5;">${senderName}</div>${senderTitle}${senderEmail}</td></tr><tr><td align="${alignment}" style="padding:13px 24px;background:#F5F5F5;border-top:1px solid rgba(0,131,143,.14);color:#00838F;font-size:11px;line-height:1.6;opacity:.75;">${labels.footer}</td></tr></table></td></tr></table>`;
}

function buildClassicGmailEmailHtml(subject: string, body: string, website = "", whatsapp = "") {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const websiteUrl = website.trim() ? (/^https?:\/\//i.test(website.trim()) ? website.trim() : `https://${website.trim()}`) : "";
  const whatsappNumber = whatsapp.replace(/\D/g, "");
  const cta = (href: string, label: string) => `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 6px 8px 0;padding:11px 16px;border:1px solid #00838F;border-radius:8px;background:#F5F5F5;color:#00838F;font-size:13px;font-weight:700;line-height:1.2;text-decoration:none;">${label} &#8594;</a>`;
  const ctas = `${websiteUrl ? cta(websiteUrl, "Visit our website") : ""}${whatsappNumber ? cta(`https://wa.me/${whatsappNumber}`, "Chat on WhatsApp") : ""}`;
  const ctaSection = ctas ? `<div style="margin:8px 24px 0;padding:18px 0 10px;border-top:1px solid #e5e7eb;"><div style="margin-bottom:10px;color:#64748b;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Continue the conversation</div>${ctas}</div>` : "";
  return `<div style="margin:0;padding:0;color:#172033;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;"><div style="max-width:640px;margin:0 auto;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#ffffff;"><div style="padding:20px 24px;border-bottom:1px solid #e5e7eb;background:#f8fafc;"><div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin-bottom:6px;">GrowthLab Outreach</div><div style="font-size:20px;line-height:1.35;font-weight:700;color:#0f172a;">${escapeHtml(subject)}</div></div><div style="padding:26px 24px 10px;">${paragraphs}</div>${ctaSection}<div style="margin:0 24px;padding:16px 0 22px;border-top:1px solid #e5e7eb;color:#64748b;font-size:12px;line-height:1.5;">Prepared with GrowthLab · Professional outreach</div></div></div>`;
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
  const [copyTarget, setCopyTarget] = useState<Message | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState(DEFAULT_OUTREACH_WEBSITE);
  const [whatsappNumber, setWhatsappNumber] = useState(DEFAULT_OUTREACH_WHATSAPP);
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
  useEffect(() => {
    const storedWebsite = window.localStorage.getItem("growthlab-outreach-website");
    setWebsiteUrl(
      !storedWebsite || storedWebsite === LEGACY_OUTREACH_WEBSITE
        ? DEFAULT_OUTREACH_WEBSITE
        : storedWebsite,
    );
    setWhatsappNumber(window.localStorage.getItem("growthlab-outreach-whatsapp") || DEFAULT_OUTREACH_WHATSAPP);
  }, []);
  useEffect(() => {
    window.localStorage.setItem("growthlab-outreach-website", websiteUrl);
  }, [websiteUrl]);
  useEffect(() => {
    window.localStorage.setItem("growthlab-outreach-whatsapp", whatsappNumber);
  }, [whatsappNumber]);
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
    const messagePayload = {
      kind: "message" as const,
      contactId: selectedContact.id,
      senderId: selectedSender?.id || null,
      subject: subject.trim(),
      body: body.trim(),
      goal: goal.trim() || undefined,
      status,
    };
    setBusy(true);
    try {
      const response = await fetch("/api/admin/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messagePayload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        const details = Array.isArray(error?.details) ? error.details.join(" ") : "";
        throw new Error(details || error?.errorKey || "Request failed");
      }
      toast.success(status === "ready" ? t("messageReady") : t("draftSaved"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : t("saveError"));
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
    const name = recordName.trim();
    const email = recordEmail.trim().toLowerCase();
    const detail = recordDetail.trim();
    if (!createKind || !name || !email) return;
    if (name.length < 2) return toast.error(t("recordNameTooShort"));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error(t("recordEmailInvalid"));
    setBusy(true);
    try {
      const payload =
        createKind === "contact"
          ? {
              kind: "contact",
              name,
              email,
              company: detail || undefined,
            }
          : {
              kind: "sender",
              name,
              email,
              title: detail || undefined,
            };
      const response = await fetch("/api/admin/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const created = await response.json().catch(() => null);
      if (!response.ok || !created?.id) {
        const details = Array.isArray(created?.details) ? created.details.join(" ") : "";
        throw new Error(details || created?.errorKey || t("recordError"));
      }
      if (createKind === "contact") {
        setContacts((current) => [created as Contact, ...current.filter((item) => item.id !== created.id)]);
        setContactId(created.id);
      } else {
        setSenders((current) => [created as Sender, ...current.filter((item) => item.id !== created.id)]);
        setSenderId(created.id);
      }
      setCreateKind(null);
      setRecordName("");
      setRecordEmail("");
      setRecordDetail("");
      toast.success(t("recordSaved"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : t("recordError"));
    } finally {
      setBusy(false);
    }
  }
  function startContactEdit(contact: Contact) { setEditingContact(contact); setContactDraft({ name: contact.name, email: contact.email, company: contact.company || "", channel: contact.channel || "", notes: contact.notes || "" }); }
  async function saveContact() { if (!editingContact || !contactDraft.name.trim() || !contactDraft.email.trim()) return; setBusy(true); try { const response = await fetch("/api/admin/outreach", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "contact", id: editingContact.id, ...contactDraft }) }); if (!response.ok) throw new Error(); toast.success(t("contactUpdated")); setEditingContact(null); await load(); } catch { toast.error(t("contactUpdateError")); } finally { setBusy(false); } }
  async function deleteContact(contact: Contact) { if (!window.confirm(t("contactDeleteConfirm"))) return; setBusy(true); try { const response = await fetch("/api/admin/outreach", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "contact", id: contact.id }) }); if (!response.ok) throw new Error(); toast.success(t("contactDeleted")); if (contactId === contact.id) setContactId(""); await load(); } catch { toast.error(t("contactDeleteError")); } finally { setBusy(false); } }
  async function copyMessage(message: Message, language: CopyLanguage) {
    const plainText = `${message.subject}\n\n${message.body}`;
    const contact = contacts.find((item) => item.id === message.contact_id);
    const sender = senders.find((item) => item.id === message.sender_id);
    const html = buildClassicGmailEmailHtml(message.subject, message.body, websiteUrl, whatsappNumber);
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
    setCopyTarget(null);
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
        <Button variant="outline" size="sm" onClick={() => setContactsOpen(true)}><UserRound />{t("manageContacts")}</Button>
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
                <FieldLabel>{t("recipient")}</FieldLabel>
                <Select
                  value={contactId}
                  onValueChange={(value) => setContactId(value || "")}
                  items={contacts.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectContact")} />
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
                <FieldLabel>{t("senderIdentity")}</FieldLabel>
                <Select
                  value={senderId || "growthlab"}
                  onValueChange={(value) =>
                    setSenderId(value === "growthlab" ? "" : value || "")
                  }
                  items={[
                    { value: "growthlab", label: t("useGrowthLab") },
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
                    <SelectItem value="growthlab">{t("useGrowthLab")}</SelectItem>
                    {senders.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} · {item.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="outreach-website"><span className="flex items-center gap-2"><Globe2 className="size-4 text-cyan-300" />{t("websiteLink")}</span></FieldLabel>
                <Input id="outreach-website" type="url" dir="ltr" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://yourcompany.com" className="border-cyan-300/20 bg-cyan-300/[0.04]" />
              </Field>
              <Field>
                <FieldLabel htmlFor="outreach-whatsapp"><span className="flex items-center gap-2"><MessageCircle className="size-4 text-emerald-300" />{t("whatsappNumber")}</span></FieldLabel>
                <Input id="outreach-whatsapp" type="tel" dir="ltr" value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)} placeholder="+1 555 123 4567" className="border-emerald-300/20 bg-emerald-300/[0.04]" />
              </Field>
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="outreach-goal">{t("goal")}</FieldLabel>
                <Input
                  id="outreach-goal"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>{t("tone")}</FieldLabel>
                <Select
                  value={tone}
                  onValueChange={(value) => setTone(value || "professional")}
                  items={[
                    { value: "professional", label: t("professional") },
                    { value: "warm", label: t("warm") },
                    { value: "direct", label: t("directTone") },
                  ]}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">{t("professional")}</SelectItem>
                    <SelectItem value="warm">{t("warm")}</SelectItem>
                    <SelectItem value="direct">{t("directTone")}</SelectItem>
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
                  {busy ? t("working") : t("generate")}
                </Button>
              </div>
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="outreach-subject">{t("subject")}</FieldLabel>
                <Input
                  id="outreach-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder={t("subjectPlaceholder")}
                />
              </Field>
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="outreach-body">{t("message")}</FieldLabel>
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
                {t("clear")}
              </Button>
              <Button
                variant="outline"
                onClick={() => void save("draft")}
                disabled={busy}
              >
                {t("saveDraft")}
              </Button>
              <Button onClick={() => void save("ready")} disabled={busy}>
                <Check />
                {t("markReady")}
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b border-white/[0.08]">
            <CardTitle className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <Clock3 className="size-4 shrink-0 text-[#54d8ac]" />
                <span className="truncate">{t("queue")}</span>
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
                {t("loading")}
              </p>
            ) : visibleMessages.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                {t("emptyQueue")}
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
                          {contact?.name || t("unknownContact")} ·{" "}
                          {contact?.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2"><Badge variant="outline" className={statusStyles[message.status].badge}>
                        <span className={`size-1.5 rounded-full ${statusStyles[message.status].dot}`} />
                        {labels[message.status]}
                      </Badge><Button variant="ghost" size="icon-sm" className="text-slate-500 opacity-60 hover:bg-cyan-400/10 hover:text-cyan-200 group-hover:opacity-100" title={t("copyMessage")} aria-label={t("copyMessage")} onClick={() => setCopyTarget(message)}><Copy /></Button><Button variant="ghost" size="icon-sm" className="text-slate-500 opacity-60 hover:bg-blue-400/10 hover:text-blue-200 group-hover:opacity-100" title={t("editMessage")} aria-label={t("editMessage")} onClick={() => startMessageEdit(message)}><Pencil /></Button><Button variant="ghost" size="icon-sm" className="border border-transparent text-slate-500 opacity-60 transition-all hover:border-red-400/20 hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100" title={t("delete")} aria-label={t("delete")} disabled={busy} onClick={() => void deleteMessage(message.id)}><Trash2 /></Button></div>
                    </div>
                    <p className="line-clamp-2 text-xs leading-5 text-slate-400">
                      {message.body}
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] text-slate-600">
                        {message.last_event || t("created")}
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
            <DialogTitle>{t("newRecord", { kind: createKind === "contact" ? t("contact") : t("sender") })}</DialogTitle>
            <DialogDescription>
              {t("recordDescription")}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="record-name">{t("name")}</FieldLabel>
              <Input
                id="record-name"
                value={recordName}
                onChange={(event) => setRecordName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="record-email">{t("email")}</FieldLabel>
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
      <Dialog open={Boolean(copyTarget)} onOpenChange={(open) => !open && setCopyTarget(null)}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>{t("copyLanguageTitle")}</DialogTitle><DialogDescription>{t("copyLanguageDescription")}</DialogDescription></DialogHeader><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Button className="h-12 justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-400" onClick={() => copyTarget && void copyMessage(copyTarget, "en")}><Copy className="size-4" />{t("copyEnglish")}</Button><Button className="h-12 justify-center gap-2 rounded-xl border border-violet-300/30 bg-violet-400/15 text-violet-100 shadow-lg shadow-violet-500/10 hover:bg-violet-400/25" onClick={() => copyTarget && void copyMessage(copyTarget, "ar")}><Copy className="size-4" />{t("copyArabic")}</Button></div></DialogContent></Dialog>
    </div>
  );
}
