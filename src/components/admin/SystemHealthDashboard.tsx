"use client";

import { useId, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  Activity, ArrowUpRight, AudioLines, Check, CheckCheck, CircleAlert,
  Clock3, Cpu, Database, Fingerprint, HardDrive, Info, KeyRound,
  Layers3, Radio, RefreshCw, Server, ShieldCheck, Sparkles, Workflow,
  type LucideIcon,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { AiUsageSummary, ModelQuota, ServiceHealth, ServiceId, ServiceStatus, SystemSnapshot } from "@/types/admin-system";

const SERVICE_ICONS: Record<ServiceId, LucideIcon> = {
  application: Server, database: Database, auth: Fingerprint, storage: HardDrive,
  gemini: Sparkles, inngest: Workflow, sentry: Activity, credentials: KeyRound,
};
const STATUS_STYLES: Record<ServiceStatus, string> = {
  operational: "border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-300",
  configured: "border-sky-300/15 bg-sky-300/[0.07] text-sky-300",
  degraded: "border-amber-300/15 bg-amber-300/[0.07] text-amber-200",
  unavailable: "border-rose-300/15 bg-rose-300/[0.07] text-rose-300",
  unconfigured: "border-amber-300/15 bg-amber-300/[0.07] text-amber-200",
  unknown: "border-slate-300/15 bg-slate-300/[0.07] text-slate-400",
};
const PANEL = "rounded-2xl border border-white/[0.08] bg-[#10131d]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]";
const ATTENTION: ServiceStatus[] = ["degraded", "unavailable", "unconfigured"];

function StatusBadge({ status }: { status: ServiceStatus }) {
  const t = useTranslations("admin.system");
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium", STATUS_STYLES[status])}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {t(`status.${status}`)}
    </span>
  );
}

function MetricCard({ label, value, hint, icon: Icon, accent }: {
  label: string; value: string; hint: string; icon: LucideIcon; accent: string;
}) {
  return (
    <article className={cn(PANEL, "relative overflow-hidden p-5")}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <Icon className={cn("size-4", accent)} strokeWidth={1.6} aria-hidden />
      </div>
      <p className="mt-4 font-satoshi text-[32px] leading-none tracking-tight text-white tabular-nums">{value}</p>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{hint}</p>
    </article>
  );
}

function SectionTitle({ icon: Icon, title, subtitle, aside }: {
  icon: LucideIcon; title: string; subtitle?: string; aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2.5 text-sm font-semibold text-slate-100">
          <Icon className="size-4 text-[#d8be78]" strokeWidth={1.7} aria-hidden />{title}
        </h2>
        {subtitle && <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  const t = useTranslations("admin.system");
  const locale = useLocale();
  const Icon = SERVICE_ICONS[service.id];
  return (
    <article className={cn(PANEL, "flex min-w-0 flex-col p-4 transition-colors hover:border-white/[0.16] sm:p-5")}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex size-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-slate-300">
          <Icon className="size-[19px]" strokeWidth={1.6} aria-hidden />
        </span>
        <StatusBadge status={service.status} />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-100">{t(`services.${service.id}.name`)}</h3>
      <p className="mt-1 text-[11px] text-slate-500">{t(`services.${service.id}.description`)}</p>
      <p className="mt-3 flex-1 text-xs leading-relaxed text-slate-400">{t(`details.${service.detail}`)}</p>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5">
          {service.check === "live" ? <Radio className="size-3" aria-hidden /> : <ShieldCheck className="size-3" aria-hidden />}
          {t(`check.${service.check}`)}
          {service.latencyMs !== null && <span className="ms-1 font-mono text-slate-400">{t("milliseconds", { value: service.latencyMs.toLocaleString(locale) })}</span>}
        </span>
        {service.dashboardUrl && (
          <a href={service.dashboardUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-sm text-slate-400 transition-colors hover:text-[#e5cd8c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d8be78]" aria-label={t("openConsoleFor", { service: t(`services.${service.id}.name`) })}>
            {t("console")}<ArrowUpRight className="size-3" aria-hidden />
          </a>
        )}
      </div>
    </article>
  );
}

function QuotaMeter({ label, used, limit, period }: {
  label: string; used: number | null; limit: number | null; period: string;
}) {
  const t = useTranslations("admin.system");
  const locale = useLocale();
  const ratio = used !== null && limit !== null ? used / limit : null;
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-300">{label}</span>
        {ratio !== null && ratio >= 0.8 && <span className={cn("text-[10px] font-medium", ratio >= 1 ? "text-rose-300" : "text-amber-200")}>{t(ratio >= 1 ? "quota.thresholdReached" : "quota.approaching")}</span>}
      </div>
      <p className="mt-2 flex items-baseline gap-1.5 text-lg font-medium text-slate-100 tabular-nums">
        {used === null ? "—" : used.toLocaleString(locale)}
        <span className="text-xs font-normal text-slate-500">/ {limit === null ? t("quota.notSet") : limit.toLocaleString(locale)}</span>
      </p>
      <div
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
        role={ratio === null ? undefined : "progressbar"}
        aria-label={label}
        aria-valuemin={ratio === null ? undefined : 0}
        aria-valuemax={ratio === null ? undefined : 100}
        aria-valuenow={ratio === null ? undefined : Math.min(100, Math.round(ratio * 100))}
        aria-valuetext={ratio === null ? undefined : `${used?.toLocaleString(locale)} / ${limit?.toLocaleString(locale)}`}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500", ratio !== null && ratio >= 1 ? "bg-rose-400" : ratio !== null && ratio >= 0.8 ? "bg-amber-300" : "bg-[#d8be78]")} style={{ width: `${ratio === null ? 0 : Math.min(100, ratio * 100)}%` }} />
      </div>
      <p className="mt-2 text-[10px] text-slate-500">{period}</p>
    </div>
  );
}

function ModelCard({ quota, usage }: { quota: ModelQuota; usage: AiUsageSummary | null }) {
  const t = useTranslations("admin.system");
  const modelUsage = usage?.models.find((model) => model.model === quota.model);
  const known = usage !== null;
  const minuteTokensKnown = known && (!modelUsage || modelUsage.minuteTokenSamples === modelUsage.minuteRequests);
  return (
    <article className={cn(PANEL, "p-5 sm:p-6")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#d8be78]/20 bg-[#d8be78]/[0.08] text-[#e5cd8c]">
            <Sparkles className="size-5" strokeWidth={1.6} aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 dir="ltr" className="break-all font-mono text-sm font-medium text-slate-100">{quota.model}</h3>
            <p className="mt-1 text-[11px] text-slate-500">{t("quota.provider")}</p>
          </div>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px]", quota.active ? "border-[#d8be78]/20 bg-[#d8be78]/[0.06] text-[#e5cd8c]" : "border-white/10 text-slate-400")}>
          {quota.active && <Check className="size-3" aria-hidden />}{t(quota.active ? "quota.active" : "quota.previous")}
        </span>
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-3 sm:gap-8">
        <QuotaMeter label={t("quota.requestsMinute")} used={known ? modelUsage?.minuteRequests ?? 0 : null} limit={quota.requestsPerMinute} period={t("quota.rollingMinute")} />
        <QuotaMeter label={t("quota.tokensMinute")} used={minuteTokensKnown ? modelUsage?.minuteInputTokens ?? 0 : null} limit={quota.inputTokensPerMinute} period={t(!known ? "metrics.noTelemetry" : minuteTokensKnown ? "quota.inputTokens" : "quota.incompleteTokens")} />
        <QuotaMeter label={t("quota.requestsDay")} used={known ? modelUsage?.dayRequests ?? 0 : null} limit={quota.requestsPerDay} period={t("quota.utcDay")} />
      </div>
    </article>
  );
}

function UsageChart({ usage }: { usage: AiUsageSummary | null }) {
  const t = useTranslations("admin.system");
  const locale = useLocale();
  const chartId = useId().replace(/:/g, "");
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", hour12: false, timeZone: "UTC" });
  return (
    <section className={cn(PANEL, "min-w-0 p-5 sm:p-6")} aria-label={t("activity.title")}>
      <SectionTitle icon={AudioLines} title={t("activity.title")} subtitle={t("activity.subtitle")} aside={<span className="rounded-md border border-white/[0.07] bg-white/[0.02] px-2 py-1 text-[10px] text-slate-400">{t("last24Hours")}</span>} />
      <div className="mt-5 flex items-center gap-4 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 rounded-full bg-[#d8be78]" aria-hidden />{t("activity.requests")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 rounded-full bg-rose-400" aria-hidden />{t("activity.failures")}</span>
      </div>
      <div className="mt-3 h-[190px] w-full" dir="ltr">
        {usage && usage.requests > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={usage.hourly} margin={{ top: 10, right: 8, bottom: 0, left: -24 }} accessibilityLayer>
              <defs><linearGradient id={chartId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d8be78" stopOpacity={0.22} /><stop offset="100%" stopColor="#d8be78" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 5" />
              <XAxis dataKey="hour" tickFormatter={(value: string) => time.format(new Date(value))} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} minTickGap={35} dy={8} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#151923", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "#cbd5e1", marginBottom: 6 }} labelFormatter={(value) => `${time.format(new Date(String(value)))} UTC`} formatter={(value: number, name: string) => [value.toLocaleString(locale), name]} />
              <Area name={t("activity.requests")} type="monotone" dataKey="requests" stroke="#d8be78" strokeWidth={2} fill={`url(#${chartId})`} isAnimationActive={false} />
              <Area name={t("activity.failures")} type="monotone" dataKey="failed" stroke="#fb7185" strokeWidth={1.5} fill="transparent" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.07] bg-white/[0.01] px-5 text-center">
            <AudioLines className="size-7 text-slate-600" strokeWidth={1.3} aria-hidden />
            <p className="text-xs text-slate-400">{t(usage ? "activity.empty" : "activity.unavailable")}</p>
            <p className="max-w-xs text-[11px] leading-relaxed text-slate-500">{t("activity.emptyHint")}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function JobQueue({ jobs }: { jobs: SystemSnapshot["jobs"] }) {
  const t = useTranslations("admin.system");
  const locale = useLocale();
  const counts = [
    { key: "queued", value: jobs?.queued, color: "text-sky-300" },
    { key: "running", value: jobs?.running, color: "text-[#e5cd8c]" },
    { key: "failed", value: jobs?.failed, color: "text-rose-300" },
  ] as const;
  return (
    <section className={cn(PANEL, "min-w-0 p-5 sm:p-6")}>
      <SectionTitle icon={Workflow} title={t("jobs.title")} subtitle={t("jobs.subtitle")} />
      <div className="mt-5 grid grid-cols-3 gap-2">
        {counts.map(({ key, value, color }) => <div key={key} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3"><p className={cn("font-satoshi text-xl tabular-nums", color)}>{value?.toLocaleString(locale) ?? "—"}</p><p className="mt-1 text-[10px] text-slate-500">{t(`jobs.${key}`)}</p></div>)}
      </div>
      <div className="mt-5 space-y-3">
        {jobs?.recent.length ? jobs.recent.slice(0, 4).map((job) => (
          <div key={job.id} className="flex items-center gap-2.5 text-[11px]">
            <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", ["failed", "dead_letter"].includes(job.status) ? "bg-rose-400" : job.status === "completed" ? "bg-emerald-400" : "bg-sky-300")} />
            <span dir="ltr" className="font-mono text-slate-400" title={job.id}>{job.id.slice(0, 8)}</span>
            <span className="truncate text-slate-500">{t(`jobs.states.${["queued", "processing", "completed", "failed", "dead_letter"].includes(job.status) ? job.status : "unknown"}`)}</span>
            <time dateTime={job.createdAt} title={new Date(job.createdAt).toLocaleString(locale, { timeZone: "UTC" }) + " UTC"} className="ms-auto shrink-0 text-[10px] text-slate-500">{new Date(job.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false })}</time>
          </div>
        )) : <p className="py-5 text-center text-xs leading-relaxed text-slate-500">{t(jobs ? "jobs.empty" : "jobs.unavailable")}</p>}
      </div>
      <p className="mt-4 text-[10px] text-slate-600">{t("jobs.timezone")}</p>
    </section>
  );
}

export default function SystemHealthDashboard() {
  const t = useTranslations("admin.system");
  const locale = useLocale();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<"all" | "live" | "configuration" | "attention">("all");
  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["admin", "system"],
    queryFn: ({ signal }) => apiFetch<SystemSnapshot>("/api/admin/system", { signal, cache: "no-store" }),
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
    retry: false,
  });
  const accessDenied = error instanceof ApiRequestError && [401, 403].includes(error.status);
  // A cached snapshot must not remain visible after the session loses access.
  const snapshot = accessDenied ? undefined : data;
  const usage = snapshot?.usage ?? null;
  const services = snapshot?.services ?? [];
  const liveServices = services.filter((service) => service.check === "live");
  const healthyServices = liveServices.filter((service) => service.status === "operational").length;
  const attentionCount = services.filter((service) => ATTENTION.includes(service.status)).length;
  const unknownCount = services.filter((service) => service.status === "unknown").length;
  const shownServices = services.filter((service) => filter === "all" || (filter === "attention" ? ATTENTION.includes(service.status) : service.check === filter));
  const formatNumber = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString(locale);
  const lastChecked = snapshot ? new Date(snapshot.checkedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC", hour12: false }) : "—";
  const hasIssue = attentionCount > 0 || unknownCount > 0 || isError;

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-2.5 flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-[#d8be78] uppercase"><Activity className="size-3.5" aria-hidden />{t("eyebrow")}</p>
          <h1 className="font-satoshi text-3xl font-medium tracking-tight text-white sm:text-[34px]">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2.5">
          {snapshot && <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[11px] text-slate-400"><Layers3 className="size-3" aria-hidden />{t(`environment.${snapshot.environment}`)}</span>}
          <Button variant="outline" disabled={isFetching} onClick={() => void refetch()} className="gap-2 rounded-lg border-white/10 px-3 text-xs"><RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} aria-hidden />{t(isFetching ? "refreshing" : "refresh")}</Button>
        </div>
      </header>

      {isError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-300/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          <p className="flex-1">{t(accessDenied ? "errors.unauthorized" : snapshot ? "errors.stale" : "errors.load")}</p>
          {accessDenied && <a href={`/${locale}/admin/login`} className="rounded-sm underline underline-offset-4 focus-visible:outline">{t("errors.signIn")}</a>}
        </div>
      )}

      {isPending ? (
        <div className="space-y-5 motion-safe:animate-pulse" role="status" aria-label={t("loading")}>
          <div className={cn(PANEL, "h-24")} />
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{[0, 1, 2, 3].map((key) => <div key={key} className={cn(PANEL, "h-36")} />)}</div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3, 4, 5, 6, 7].map((key) => <div key={key} className={cn(PANEL, "h-52")} />)}</div>
          <span className="sr-only">{t("loading")}</span>
        </div>
      ) : snapshot ? (
        <>
          <section className={cn("relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl border px-5 py-5 sm:px-6", hasIssue ? "border-amber-300/[0.15] bg-gradient-to-r from-amber-300/[0.045] to-transparent" : "border-emerald-300/[0.15] bg-gradient-to-r from-emerald-300/[0.055] to-transparent")} aria-label={t("summary.label")}>
            <div className="flex items-center gap-4">
              <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full border", hasIssue ? "border-amber-300/20 bg-amber-300/[0.07] text-amber-200" : "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-300")}>
                {hasIssue ? <CircleAlert className="size-5" strokeWidth={1.7} aria-hidden /> : <CheckCheck className="size-5" strokeWidth={1.7} aria-hidden />}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-100">{t(isError ? "summary.stale" : attentionCount ? "summary.attention" : unknownCount ? "summary.unknown" : "summary.healthy", { count: attentionCount })}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{t("summary.detail", { healthy: healthyServices, total: liveServices.length })}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-500">
              <span className="flex items-center gap-1.5" aria-live="polite"><Clock3 className="size-3" aria-hidden />{t("checkedAt", { time: lastChecked })}</span>
              <button type="button" aria-pressed={autoRefresh} onClick={() => setAutoRefresh((value) => !value)} className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-2 text-slate-400 transition-colors hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d8be78]">
                <span className={cn("size-1.5 rounded-full", autoRefresh ? "bg-emerald-300" : "bg-slate-500")} aria-hidden />{t(autoRefresh ? "autoRefreshOn" : "autoRefreshOff")}
              </button>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label={t("metrics.services")} value={`${formatNumber(healthyServices)} / ${formatNumber(liveServices.length)}`} hint={t("metrics.servicesHint")} icon={Radio} accent="text-emerald-300" />
            <MetricCard label={t("metrics.requests")} value={formatNumber(usage?.requests)} hint={t("metrics.requestsHint")} icon={Cpu} accent="text-[#e5cd8c]" />
            <MetricCard label={t("metrics.tokens")} value={formatNumber(usage && (usage.tokenSamples > 0 || usage.requests === 0) ? usage.tokens : null)} hint={usage && usage.tokenSamples < usage.requests ? t("metrics.partialTokens", { count: usage.tokenSamples, total: usage.requests }) : t("metrics.tokensHint")} icon={Sparkles} accent="text-violet-300" />
            <MetricCard label={t("metrics.failures")} value={formatNumber(usage?.failed)} hint={usage ? t("metrics.failuresHint", { count: usage.rateLimited }) : t("metrics.noTelemetry")} icon={CircleAlert} accent={usage?.failed ? "text-rose-300" : "text-sky-300"} />
          </div>

          <section className="space-y-4">
            <SectionTitle icon={Layers3} title={t("servicesTitle")} subtitle={t("servicesSubtitle")} aside={
              <div className="flex flex-wrap gap-1 rounded-lg border border-white/[0.06] bg-black/10 p-1" role="group" aria-label={t("filters.label")}>
                {(["all", "live", "configuration", "attention"] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={cn("rounded-md px-2.5 py-1.5 text-[10px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d8be78]", filter === value ? "bg-white/[0.08] text-slate-100" : "text-slate-500 hover:text-slate-300")}>{t(`filters.${value}`)}{value === "attention" && attentionCount > 0 && <span className="ms-1.5 text-amber-200">{attentionCount}</span>}</button>)}
              </div>
            } />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{shownServices.map((service) => <ServiceCard key={service.id} service={service} />)}</div>
            {!shownServices.length && <div className={cn(PANEL, "flex items-center justify-center gap-2 p-8 text-xs text-slate-400")}><CheckCheck className="size-4 text-emerald-300" aria-hidden />{t("filters.empty")}</div>}
          </section>

          {snapshot.usageStatus !== "available" && (
            <div className="flex items-start gap-3 rounded-xl border border-sky-300/15 bg-sky-300/[0.04] p-4" role="status">
              <Info className="mt-0.5 size-4 shrink-0 text-sky-300" aria-hidden />
              <div><p className="text-xs font-medium text-sky-200">{t(snapshot.usageStatus === "setup_required" ? "tracking.setupTitle" : "tracking.unavailableTitle")}</p><p className="mt-1 text-xs leading-relaxed text-slate-400">{t(snapshot.usageStatus === "setup_required" ? "tracking.setupHint" : "tracking.unavailableHint")}</p></div>
            </div>
          )}

          <section className="space-y-4">
            <SectionTitle icon={Sparkles} title={t("quota.title")} subtitle={t("quota.subtitle")} aside={<a href="https://aistudio.google.com/usage" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[11px] text-slate-300 transition-colors hover:border-[#d8be78]/30 hover:text-[#e5cd8c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d8be78]">{t("quota.providerConsole")}<ArrowUpRight className="size-3" aria-hidden /></a>} />
            {snapshot.quotas.map((quota) => <ModelCard key={quota.model} quota={quota} usage={usage} />)}
            <p className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-slate-500"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />{t("quota.disclaimer")}</p>
          </section>

          <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <UsageChart usage={usage} />
            <JobQueue jobs={snapshot.jobs} />
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4 text-[10px] leading-relaxed text-slate-600">
            <span className="flex items-center gap-1.5"><ShieldCheck className="size-3" aria-hidden />{t("footer.private")}</span>
            <span>{t("footer.probes")}</span>
          </footer>
        </>
      ) : null}
    </div>
  );
}
