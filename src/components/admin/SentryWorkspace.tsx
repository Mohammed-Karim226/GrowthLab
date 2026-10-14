"use client";

import { useState, type ReactNode } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, BellRing, BookOpen,
  Bug, ChevronDown, CircleAlert, CircleCheck, Clock3, Code2,
  Copy, ExternalLink, FileCode2, Fingerprint, GitBranch, Inbox,
  Layers3, ListChecks, Play, Radio, RefreshCw, Search,
  Settings2, ShieldCheck, TerminalSquare, X, type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { SentryIssue, SentryIssueStatus, SentryLinks, SentryPeriod, SentryWorkspaceSnapshot } from "@/types/sentry";

const PANEL = "rounded-2xl border border-white/[0.08] bg-[#10131d]/80";
const INPUT = "h-9 min-w-0 rounded-lg border border-white/10 bg-[#141824] px-3 text-xs text-slate-300 outline-none focus-visible:border-violet-300/50 focus-visible:ring-2 focus-visible:ring-violet-300/15";
type WorkspaceTab = "issues" | "implementation" | "workflow";
type Translator = ReturnType<typeof useTranslations>;

function Outbound({ href, children, className }: { href: string | null | undefined; children: ReactNode; className?: string }) {
  if (!href) return <span className={cn("inline-flex items-center gap-1.5 text-slate-600", className)}>{children}<ArrowUpRight className="size-3.5" aria-hidden /></span>;
  return <a href={href} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1.5 rounded-sm text-violet-200 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300", className)}>{children}<ArrowUpRight className="size-3.5 shrink-0" aria-hidden /></a>;
}

function SectionHeading({ icon: Icon, title, subtitle, aside }: { icon: LucideIcon; title: string; subtitle: string; aside?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Icon className="size-4 text-violet-300" strokeWidth={1.7} aria-hidden />{title}</h3><p className="mt-1.5 text-xs leading-relaxed text-slate-500">{subtitle}</p></div>{aside}</div>;
}

function IssueLevel({ issue }: { issue: SentryIssue }) {
  const t = useTranslations("admin.sentry");
  return <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium", ["fatal", "error"].includes(issue.level) ? "bg-rose-400/[0.09] text-rose-300" : issue.level === "warning" ? "bg-amber-300/[0.08] text-amber-200" : "bg-sky-300/[0.08] text-sky-300")}><span className="size-1 rounded-full bg-current" aria-hidden />{t(`levels.${issue.level}`)}</span>;
}

function formatDate(value: string | null | undefined, locale: string) {
  return value ? new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(value)) : "—";
}

function ProjectLinks({ links }: { links: SentryLinks | undefined }) {
  const t = useTranslations("admin.sentry");
  const items: Array<{ key: keyof SentryLinks; icon: LucideIcon }> = [
    { key: "issues", icon: Bug }, { key: "performance", icon: Activity },
    { key: "replays", icon: Play }, { key: "releases", icon: GitBranch },
    { key: "alerts", icon: BellRing }, { key: "settings", icon: Settings2 },
  ];
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{items.map(({ key, icon: Icon }) => <Outbound key={key} href={links?.[key]} className={cn(PANEL, "justify-between gap-2 px-3 py-3.5 text-[11px]")}><span className="flex items-center gap-2"><Icon className="size-3.5 shrink-0" aria-hidden />{t(`links.${key}`)}</span></Outbound>)}</div>;
}

function CopyBriefButton({ issue, environment, period }: { issue: SentryIssue; environment: string; period: SentryPeriod }) {
  const t = useTranslations("admin.sentry");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    const brief = [
      `${issue.shortId}: ${issue.title}`,
      `${t("brief.environment")}: ${environment}`,
      `${t("brief.period")}: ${t(`periods.${period}`)}`,
      `${t("brief.location")}: ${issue.location ?? "—"}`,
      `${t("brief.firstSeen")}: ${issue.firstSeen ?? "—"}`,
      `${t("brief.lastSeen")}: ${issue.lastSeen ?? "—"}`,
      `${t("brief.link")}: ${issue.url}`, "",
      t("brief.reproduce"), t("brief.cause"), t("brief.fix"), t("brief.verify"),
    ].join("\n");
    try { await navigator.clipboard.writeText(brief); setCopyState("copied"); }
    catch { setCopyState("failed"); }
  }
  return <div><Button variant="outline" onClick={() => void copy()} className="gap-2 text-xs"><Copy className="size-3.5" aria-hidden />{t(copyState === "copied" ? "issue.copied" : "issue.copyBrief")}</Button>{copyState === "failed" && <p role="status" className="mt-2 text-xs text-amber-200">{t("issue.copyFailed")}</p>}</div>;
}

function IssueDetails({ issue, onClose, snapshot }: { issue: SentryIssue | null; onClose: () => void; snapshot: SentryWorkspaceSnapshot | undefined }) {
  const t = useTranslations("admin.sentry");
  const locale = useLocale();
  return <Dialog open={Boolean(issue)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-w-2xl" dir={locale === "ar" ? "rtl" : "ltr"}>
      {issue && <>
        <DialogHeader><div className="mb-2 flex items-center gap-2"><span className="font-mono text-xs text-violet-300">{issue.shortId}</span><IssueLevel issue={issue} /></div><DialogTitle className="break-words text-lg">{issue.title}</DialogTitle><DialogDescription>{t("issue.detailsHint")}</DialogDescription></DialogHeader>
        <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          {[
            [t("issue.status"), t(`statuses.${issue.status}`)],
            [t("issue.events"), issue.events?.toLocaleString(locale) ?? "—"],
            [t("issue.users"), issue.users?.toLocaleString(locale) ?? "—"],
            [t("issue.firstSeen"), formatDate(issue.firstSeen, locale)],
            [t("issue.lastSeen"), formatDate(issue.lastSeen, locale)],
            [t("issue.environment"), snapshot?.filters.environment ?? t("filters.allEnvironments")],
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><dt className="text-[10px] text-slate-500">{label}</dt><dd className="mt-1.5 break-words font-medium text-slate-200">{value}</dd></div>)}
        </dl>
        {issue.location && <div className="rounded-xl border border-white/[0.08] bg-black/15 p-3"><p className="mb-2 text-[10px] text-slate-500">{t("issue.location")}</p><code dir="ltr" className="block break-all text-xs text-slate-300">{issue.location}</code></div>}
        <div className="rounded-xl border border-violet-300/15 bg-violet-300/[0.04] p-4"><h4 className="flex items-center gap-2 text-xs font-semibold text-violet-200"><ListChecks className="size-4" aria-hidden />{t("issue.nextSteps")}</h4><ol className="mt-3 space-y-3">{["inspect", "reproduce", "fix", "verify"].map((step, index) => <li key={step} className="flex gap-2.5 text-xs leading-relaxed text-slate-400"><span className="font-mono text-violet-300">{index + 1}.</span>{t(`issue.steps.${step}`)}</li>)}</ol></div>
        <p className="flex gap-2 text-[11px] leading-relaxed text-slate-500"><CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />{t("issue.resolveHint")}</p>
        <div className="flex flex-wrap items-center justify-between gap-3"><CopyBriefButton key={issue.id} issue={issue} period={snapshot?.filters.period ?? "14d"} environment={snapshot?.filters.environment ?? t("filters.allEnvironments")} /><Outbound href={issue.url} className="rounded-xl border border-violet-300/20 bg-violet-300/10 px-4 py-2.5 text-xs font-medium">{t("issue.openFull")}</Outbound></div>
      </>}
    </DialogContent>
  </Dialog>;
}

function Implementation({ snapshot }: { snapshot: SentryWorkspaceSnapshot }) {
  const t = useTranslations("admin.sentry");
  const locale = useLocale();
  const c = snapshot.configuration;
  const percent = (value: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value);
  const features: Array<{ key: string; icon: LucideIcon; status: "enabled" | "disabled" | "configured" | "review"; detail?: string }> = [
    { key: "browser", icon: Bug, status: c.browserEnabled ? "enabled" : "disabled" },
    { key: "server", icon: TerminalSquare, status: c.sdkEnabled ? "enabled" : "disabled" },
    { key: "handled", icon: Layers3, status: c.sdkEnabled ? "enabled" : "disabled" },
    { key: "tracing", icon: Activity, status: c.sdkEnabled && c.tracesSampleRate > 0 ? "enabled" : "disabled", detail: percent(c.tracesSampleRate) },
    { key: "replay", icon: Play, status: c.browserEnabled && (c.replaySessionSampleRate > 0 || c.replayOnErrorSampleRate > 0) ? "enabled" : "disabled", detail: t("implementation.replayRates", { session: percent(c.replaySessionSampleRate), error: percent(c.replayOnErrorSampleRate) }) },
    { key: "privacy", icon: Fingerprint, status: "enabled" },
    { key: "sourceMaps", icon: FileCode2, status: c.sourceMaps === "configured" ? "configured" : c.sourceMaps === "disabled" ? "disabled" : "review" },
    { key: "releases", icon: GitBranch, status: c.release ? "configured" : "review", detail: c.release ?? undefined },
    { key: "alerts", icon: BellRing, status: "review" },
  ];
  return <div className="space-y-5">
    <section className={cn(PANEL, "p-5 sm:p-6")}>
      <SectionHeading icon={ShieldCheck} title={t("implementation.title")} subtitle={t("implementation.subtitle")} />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{features.map(({ key, icon: Icon, status, detail }) => <article key={key} className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-4"><div className="flex items-center justify-between gap-2"><Icon className="size-4 text-slate-400" strokeWidth={1.6} aria-hidden /><span className={cn("rounded-full px-2 py-0.5 text-[10px]", status === "enabled" ? "bg-emerald-300/[0.07] text-emerald-300" : status === "configured" ? "bg-sky-300/[0.07] text-sky-300" : "bg-amber-300/[0.07] text-amber-200")}>{t(`implementation.states.${status}`)}</span></div><h4 className="mt-3 text-xs font-semibold text-slate-200">{t(`implementation.features.${key}.title`)}</h4><p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{t(`implementation.features.${key}.body`)}</p>{detail && <p className="mt-3 break-all text-[10px] font-medium text-violet-200">{detail}</p>}</article>)}</div>
      <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500"><CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />{t("implementation.disclaimer")}</p>
    </section>
    <section className={cn(PANEL, "p-5 sm:p-6")}>
      <SectionHeading icon={Settings2} title={t("setup.title")} subtitle={t("setup.subtitle")} aside={<Outbound href="https://docs.sentry.io/platforms/javascript/guides/nextjs/" className="text-[11px]">{t("setup.docs")}</Outbound>} />
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <ol className="space-y-5">{["project", "runtime", "readToken", "deploy"].map((key, index) => <li key={key} className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-violet-300/20 bg-violet-300/[0.05] font-mono text-[10px] text-violet-300">{index + 1}</span><div><h4 className="text-xs font-semibold text-slate-200">{t(`setup.steps.${key}.title`)}</h4><p className="mt-1 text-xs leading-relaxed text-slate-500">{t(`setup.steps.${key}.body`)}</p></div></li>)}</ol>
        <div><div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#090c13]"><div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5 text-[10px] text-slate-500"><TerminalSquare className="size-3" aria-hidden />{t("setup.variables")}</div><pre dir="ltr" className="overflow-x-auto p-4 text-[11px] leading-7 text-violet-200"><code>{`NEXT_PUBLIC_SENTRY_DSN=<project-dsn>\nNEXT_PUBLIC_SENTRY_ENABLED=true\nNEXT_PUBLIC_SENTRY_ENVIRONMENT=production\nSENTRY_ORG=<organization-slug>\nSENTRY_PROJECT=<project-slug>\nSENTRY_READ_AUTH_TOKEN=<read-only-token>\nSENTRY_REGION=us`}</code></pre></div><p className="mt-3 flex gap-2 text-[11px] leading-relaxed text-slate-500"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />{t("setup.tokenNotice")}</p><div className="mt-3 flex flex-wrap gap-4 text-[11px]"><Outbound href={snapshot.links.projectKeys}>{t("setup.projectKeys")}</Outbound><Outbound href="https://sentry.io/settings/account/api/auth-tokens/">{t("setup.createToken")}</Outbound></div></div>
      </div>
      <details className="group mt-6 rounded-xl border border-white/[0.07] bg-white/[0.015]"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-xs font-medium text-slate-300"><span className="flex items-center gap-2"><FileCode2 className="size-4 text-violet-300" aria-hidden />{t("setup.buildTitle")}</span><ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden /></summary><div className="space-y-3 border-t border-white/[0.06] p-4 text-xs leading-relaxed text-slate-400"><p>{t("setup.buildBody")}</p><code dir="ltr" className="block break-words rounded-lg bg-black/20 p-3 text-[11px] text-violet-200">SENTRY_AUTH_TOKEN · SENTRY_ORG · SENTRY_PROJECT · SENTRY_RELEASE</code><p>{t("setup.buildVerify")}</p></div></details>
    </section>
  </div>;
}

function FixWorkflow({ links }: { links: SentryLinks | undefined }) {
  const t = useTranslations("admin.sentry");
  const steps: Array<{ key: string; icon: LucideIcon }> = [
    { key: "triage", icon: Inbox }, { key: "inspect", icon: Search },
    { key: "reproduce", icon: Play }, { key: "repair", icon: Code2 },
    { key: "release", icon: GitBranch }, { key: "verify", icon: CircleCheck },
  ];
  return <div className="space-y-5">
    <section className={cn(PANEL, "p-5 sm:p-6")}><SectionHeading icon={ListChecks} title={t("workflow.title")} subtitle={t("workflow.subtitle")} /><ol className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{steps.map(({ key, icon: Icon }, index) => <li key={key} className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.018] p-5"><span aria-hidden className="absolute end-4 top-3 font-mono text-3xl text-white/[0.045]">0{index + 1}</span><Icon className="size-5 text-violet-300" strokeWidth={1.6} aria-hidden /><h4 className="mt-4 text-sm font-semibold text-slate-200">{t(`workflow.steps.${key}.title`)}</h4><p className="mt-2 text-xs leading-6 text-slate-400">{t(`workflow.steps.${key}.body`)}</p></li>)}</ol><p className="mt-5 flex gap-2 rounded-xl border border-amber-300/10 bg-amber-300/[0.025] p-3.5 text-xs leading-relaxed text-amber-100/70"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{t("workflow.resolveNotice")}</p></section>
    <section className={cn(PANEL, "p-5 sm:p-6")}><SectionHeading icon={BookOpen} title={t("troubleshooting.title")} subtitle={t("troubleshooting.subtitle")} /><div className="mt-5 divide-y divide-white/[0.06]">{["noIssues", "access", "sourceMaps", "missingReplay", "noise", "regression"].map((key) => <details key={key} className="group"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-xs font-medium text-slate-300">{t(`troubleshooting.items.${key}.title`)}<ChevronDown className="size-3.5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden /></summary><p className="pb-5 pe-6 text-xs leading-6 text-slate-400">{t(`troubleshooting.items.${key}.body`)}</p></details>)}</div><div className="flex flex-wrap gap-5 border-t border-white/[0.06] pt-4 text-xs"><Outbound href={links?.issues}>{t("workflow.openIssues")}</Outbound><Outbound href={links?.alerts}>{t("workflow.configureAlerts")}</Outbound></div></section>
  </div>;
}

function InboxNotice({ connection, t, onSetup }: { connection: SentryWorkspaceSnapshot["connection"]; t: Translator; onSetup: () => void }) {
  return <div className="flex flex-col items-center px-5 py-12 text-center"><span className="flex size-12 items-center justify-center rounded-2xl border border-violet-300/15 bg-violet-300/[0.05] text-violet-300"><Radio className="size-6" strokeWidth={1.5} aria-hidden /></span><h4 className="mt-4 text-sm font-medium text-slate-200">{t(`connection.${connection}.title`)}</h4><p className="mt-2 max-w-lg text-xs leading-6 text-slate-500">{t(`connection.${connection}.body`)}</p><Button variant="outline" onClick={onSetup} className="mt-5 gap-2 text-xs"><Settings2 className="size-3.5" aria-hidden />{t("setup.open")}</Button></div>;
}

export default function SentryWorkspace() {
  const t = useTranslations("admin.sentry");
  const locale = useLocale();
  const [tab, setTab] = useState<WorkspaceTab>("issues");
  const [status, setStatus] = useState<SentryIssueStatus>("unresolved");
  const [period, setPeriod] = useState<SentryPeriod>("14d");
  const [environment, setEnvironment] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<string | null>>([]);
  const [search, setSearch] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<SentryIssue | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const params = new URLSearchParams({ status, period });
  if (environment) params.set("environment", environment);
  if (cursor) params.set("cursor", cursor);
  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["admin", "sentry", status, period, environment, cursor],
    queryFn: ({ signal }) => apiFetch<SentryWorkspaceSnapshot>(`/api/admin/system/sentry?${params}`, { signal, cache: "no-store" }),
    refetchInterval: autoRefresh && tab === "issues" && !cursor ? 60_000 : false,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
    retry: false,
  });
  const denied = error instanceof ApiRequestError && [401, 403].includes(error.status);
  const snapshot = denied ? undefined : data;
  const connected = snapshot?.connection === "connected";
  const issues = snapshot?.issues ?? [];
  const filtered = issues.filter((issue) => `${issue.title} ${issue.shortId} ${issue.location ?? ""}`.toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale)));
  const knownEvents = connected && issues.every((issue) => issue.events !== null);
  const eventCount = knownEvents ? issues.reduce((total, issue) => total + (issue.events ?? 0), 0).toLocaleString(locale) : "—";
  const resetPage = () => { setCursor(null); setHistory([]); setSelectedIssue(null); setSearch(""); };
  const tabs: Array<{ id: WorkspaceTab; icon: LucideIcon }> = [{ id: "issues", icon: Inbox }, { id: "implementation", icon: ShieldCheck }, { id: "workflow", icon: ListChecks }];
  const config = snapshot?.configuration;
  const environments = Array.from(new Set([config?.environment, "production", "preview", "development"].filter((value): value is string => Boolean(value && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value)))));
  const statusItems = (["unresolved", "resolved", "ignored"] as const).map((value) => ({ value, label: t(`statuses.${value}`) }));
  const periodItems = (["24h", "7d", "14d"] as const).map((value) => ({ value, label: t(`periods.${value}`) }));
  const environmentItems = [{ value: "", label: t("filters.allEnvironments") }, ...environments.map((value) => ({ value, label: value }))];

  return <div className="space-y-6">
    <header className="relative overflow-hidden rounded-3xl border border-violet-300/[0.13] bg-[radial-gradient(ellipse_at_top_right,rgba(167,139,250,0.11),transparent_65%)] p-5 sm:p-7">
      <div aria-hidden className="pointer-events-none absolute -end-9 -top-6 rotate-12 text-violet-300/[0.045]"><Bug className="size-56" strokeWidth={0.7} /></div>
      <div className="relative flex flex-wrap items-start justify-between gap-5"><div className="max-w-2xl"><p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-violet-300 uppercase"><Radio className="size-3.5" aria-hidden />{t("eyebrow")}</p><h1 className="mt-3 font-satoshi text-3xl text-white">{t("title")}</h1><p className="mt-2 text-sm leading-relaxed text-slate-400">{t("subtitle")}</p><div className="mt-5 flex flex-wrap items-center gap-2"><span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium", connected && !isError ? "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-300" : "border-violet-300/15 bg-violet-300/[0.04] text-violet-200")}><span className="size-1.5 rounded-full bg-current" aria-hidden />{t(isError ? "connectionLabel.stale" : connected ? "connectionLabel.connected" : snapshot && snapshot.connection !== "setup_required" ? `connection.${snapshot.connection}.title` : "connectionLabel.setup")}</span>{config?.organization && config.project && <span dir="ltr" className="rounded-md border border-white/[0.07] bg-black/10 px-2.5 py-1 font-mono text-[10px] text-slate-400">{config.organization} / {config.project}</span>}</div></div><div className="flex items-center gap-2"><Button variant="outline" disabled={isFetching} onClick={() => void refetch()} className="gap-2 text-xs"><RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} aria-hidden />{t(isFetching ? "refreshing" : "refresh")}</Button><Outbound href={snapshot?.links.issues} className="rounded-xl border border-violet-300/20 bg-violet-300/10 px-3 py-2 text-xs">{t("openSentry")}</Outbound></div></div>
    </header>

    {isError && <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-4 text-xs leading-relaxed text-rose-200"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /><div><p>{t(denied ? "errors.access" : snapshot ? "errors.stale" : "errors.load")}</p>{denied && <a href={`/${locale}/admin/login`} className="mt-2 inline-block underline underline-offset-4">{t("errors.signIn")}</a>}</div></div>}

    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08]">
      <div className="flex max-w-full gap-1 overflow-x-auto" role="tablist" aria-label={t("tabs.label")} onKeyDown={(event) => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const current = tabs.findIndex((entry) => entry.id === tab); const direction = (event.key === "ArrowRight" ? 1 : -1) * (locale === "ar" ? -1 : 1); const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + direction + tabs.length) % tabs.length; setTab(tabs[next].id); document.getElementById(`sentry-tab-${tabs[next].id}`)?.focus(); }}>{tabs.map(({ id, icon: Icon }) => <button type="button" key={id} role="tab" id={`sentry-tab-${id}`} aria-controls={`sentry-panel-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} className={cn("inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3.5 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300", tab === id ? "border-violet-300 text-violet-200" : "border-transparent text-slate-500 hover:text-slate-300")}><Icon className="size-3.5" aria-hidden />{t(`tabs.${id}`)}</button>)}</div>
      {snapshot && <span className="pb-2 text-[10px] text-slate-500">{t("checkedAt", { time: formatDate(snapshot.checkedAt, locale) })}</span>}
    </div>

    {isPending ? <div role="status" aria-label={t("loading")} className="space-y-4 motion-safe:animate-pulse"><span className="sr-only">{t("loading")}</span><div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((key) => <div key={key} className={cn(PANEL, "h-24")} />)}</div><div className={cn(PANEL, "h-80")} /></div> : <>
      {tab === "issues" && <div role="tabpanel" id="sentry-panel-issues" aria-labelledby="sentry-tab-issues" className="space-y-5">
        <ProjectLinks links={snapshot?.links} />
        <div className="grid gap-3 sm:grid-cols-3">{[
          { key: "issues", value: connected ? issues.length.toLocaleString(locale) : "—", icon: Bug },
          { key: "events", value: eventCount, icon: Activity },
          { key: "environment", value: environment || t("filters.allEnvironments"), icon: Layers3 },
        ].map(({ key, value, icon: Icon }) => <article key={key} className={cn(PANEL, "p-4 sm:p-5")}><div className="flex items-center justify-between text-xs text-slate-500"><span>{t(`metrics.${key}.label`)}</span><Icon className="size-4 text-violet-300" strokeWidth={1.5} aria-hidden /></div><p className="mt-3 truncate font-satoshi text-2xl text-slate-100 tabular-nums">{value}</p><p className="mt-2 text-[10px] leading-relaxed text-slate-500">{t(`metrics.${key}.hint`)}</p></article>)}</div>
        <section className={cn(PANEL, "overflow-hidden")} aria-label={t("inbox.title")}>
          <div className="space-y-4 border-b border-white/[0.06] p-4 sm:p-5"><SectionHeading icon={Inbox} title={t("inbox.title")} subtitle={t("inbox.subtitle")} aside={<button type="button" onClick={() => setAutoRefresh((value) => !value)} aria-pressed={autoRefresh} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"><span className={cn("size-1.5 rounded-full", autoRefresh && !cursor ? "bg-emerald-300" : "bg-slate-500")} aria-hidden />{t(cursor ? "inbox.refreshPaging" : autoRefresh ? "inbox.autoOn" : "inbox.autoOff")}</button>} />
            <DirectionProvider direction={locale === "ar" ? "rtl" : "ltr"}>
            <div className="flex flex-wrap gap-2">
              <label className="relative min-w-40 flex-1"><span className="sr-only">{t("filters.search")}</span><Search className="pointer-events-none absolute start-3 top-3 size-3.5 text-slate-500" aria-hidden /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("filters.search")} className={cn(INPUT, "w-full pe-3 ps-9")} />{search && <button type="button" aria-label={t("filters.clear")} onClick={() => setSearch("")} className="absolute end-2 top-2 p-1 text-slate-400"><X className="size-3" aria-hidden /></button>}</label>
              <Select
                value={status}
                items={statusItems}
                onValueChange={(next) => { if (next !== null) { setStatus(next); resetPage(); } }}
              >
                <SelectTrigger aria-label={t("filters.status")} className="h-9 w-auto min-w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir={locale === "ar" ? "rtl" : "ltr"}>
                  {statusItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={period}
                items={periodItems}
                onValueChange={(next) => { if (next !== null) { setPeriod(next); resetPage(); } }}
              >
                <SelectTrigger aria-label={t("filters.period")} className="h-9 w-auto min-w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir={locale === "ar" ? "rtl" : "ltr"}>
                  {periodItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={environment}
                items={environmentItems}
                onValueChange={(next) => { if (next !== null) { setEnvironment(next); resetPage(); } }}
              >
                <SelectTrigger aria-label={t("filters.environment")} className="h-9 w-auto min-w-40 max-w-full text-xs">
                  <SelectValue className="truncate" />
                </SelectTrigger>
                <SelectContent dir={locale === "ar" ? "rtl" : "ltr"}>
                  {environmentItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            </DirectionProvider>
          </div>
          {!snapshot ? <div className="p-10 text-center text-xs text-slate-500">{t("inbox.unavailable")}</div> : !connected ? <InboxNotice connection={snapshot.connection} t={t} onSetup={() => setTab("implementation")} /> : filtered.length ? <div className="divide-y divide-white/[0.055]">{filtered.map((issue) => <article key={issue.id} className="group flex items-start gap-3 px-4 py-4 transition-colors hover:bg-white/[0.025] sm:px-5"><span className={cn("mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg border", issue.level === "fatal" || issue.level === "error" ? "border-rose-300/10 bg-rose-300/[0.04] text-rose-300" : "border-amber-300/10 bg-amber-300/[0.04] text-amber-200")}><Bug className="size-4" strokeWidth={1.6} aria-hidden /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] text-slate-500">{issue.shortId}</span><IssueLevel issue={issue} /></div><button type="button" onClick={() => setSelectedIssue(issue)} className="mt-1.5 block max-w-full rounded-sm text-start text-sm font-medium break-words text-slate-200 transition-colors hover:text-violet-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300">{issue.title}</button>{issue.location && <p dir="ltr" className="mt-1 truncate text-start font-mono text-[10px] text-slate-500">{issue.location}</p>}<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500"><span>{t("inbox.events", { count: issue.events?.toLocaleString(locale) ?? "—" })}</span><span className="flex items-center gap-1"><Clock3 className="size-2.5" aria-hidden />{formatDate(issue.lastSeen, locale)} UTC</span></div></div><a href={issue.url} target="_blank" rel="noopener noreferrer" className="mt-1 rounded-lg border border-transparent p-2 text-slate-500 transition-colors hover:border-white/10 hover:text-violet-200" aria-label={t("inbox.openIssue", { id: issue.shortId })}><ExternalLink className="size-3.5" aria-hidden /></a></article>)}</div> : <div className="flex flex-col items-center px-5 py-12 text-center"><CircleCheck className="size-8 text-slate-600" strokeWidth={1.25} aria-hidden /><h4 className="mt-4 text-sm text-slate-300">{t(search ? "inbox.noMatches" : "inbox.empty")}</h4><p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500">{t(search ? "inbox.noMatchesHint" : "inbox.emptyHint")}</p></div>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3 sm:px-5"><p className="text-[10px] text-slate-500">{t("inbox.page", { page: history.length + 1 })} · {t("inbox.pageScope")}</p><div className="flex gap-2"><Button size="sm" variant="ghost" disabled={!history.length || isFetching} onClick={() => { setSelectedIssue(null); setCursor(history[history.length - 1] ?? null); setHistory((values) => values.slice(0, -1)); setSearch(""); }} className="gap-1 text-[11px]"><ArrowLeft className="size-3 rtl:rotate-180" aria-hidden />{t("inbox.previous")}</Button><Button size="sm" variant="ghost" disabled={!connected || !snapshot?.nextCursor || isFetching} onClick={() => { setSelectedIssue(null); setHistory((values) => [...values, cursor]); setCursor(snapshot?.nextCursor ?? null); setSearch(""); }} className="gap-1 text-[11px]">{t("inbox.next")}<ArrowRight className="size-3 rtl:rotate-180" aria-hidden /></Button></div></div>
        </section>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-300/10 bg-violet-300/[0.025] p-4"><div className="flex items-center gap-3"><BookOpen className="size-5 text-violet-300" strokeWidth={1.5} aria-hidden /><div><h3 className="text-xs font-medium text-slate-200">{t("inbox.helpTitle")}</h3><p className="mt-1 text-[11px] text-slate-500">{t("inbox.helpHint")}</p></div></div><Button variant="ghost" onClick={() => setTab("workflow")} className="gap-2 text-xs text-violet-200">{t("inbox.helpAction")}<ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden /></Button></div>
      </div>}
      {tab === "implementation" && <div role="tabpanel" id="sentry-panel-implementation" aria-labelledby="sentry-tab-implementation">{snapshot ? <Implementation snapshot={snapshot} /> : <p className="py-8 text-center text-sm text-slate-500">{t("errors.load")}</p>}</div>}
      {tab === "workflow" && <div role="tabpanel" id="sentry-panel-workflow" aria-labelledby="sentry-tab-workflow"><FixWorkflow links={snapshot?.links} /></div>}
    </>}

    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-4 text-[10px] leading-relaxed text-slate-500"><span className="flex items-center gap-1.5"><ShieldCheck className="size-3" aria-hidden />{t("footer.private")}</span><span>{t("footer.readOnly")}</span></footer>
    <IssueDetails issue={denied ? null : selectedIssue} onClose={() => setSelectedIssue(null)} snapshot={snapshot} />
  </div>;
}
