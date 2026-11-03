import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import {
  sentryDsn,
  sentryEnabled,
  sentryEnvironment,
  sentryRelease,
  sentryReplayErrorSampleRate,
  sentryReplaySessionSampleRate,
  sentryTracesSampleRate,
} from "@/lib/env";
import type {
  SentryConfiguration,
  SentryConnection,
  SentryIssue,
  SentryLinks,
  SentryWorkspaceSnapshot,
} from "@/types/sentry";

const TIMEOUT_MS = 5_000;
const MAX_BODY_BYTES = 1_024 * 1_024;
const CACHE_MS = 30_000;
const MAX_CACHE_ENTRIES = 20;
const SLUG = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;
const ID = /^\d{1,30}$/;
const CURSOR = /^\d{1,30}:\d{1,10}:[01]$/;
const ENVIRONMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

/** Only these fields can become Sentry search parameters. No free-form query. */
export const sentryFiltersSchema = z.object({
  status: z.enum(["unresolved", "resolved", "ignored"]).default("unresolved"),
  period: z.enum(["24h", "7d", "14d"]).default("14d"),
  environment: z.string().regex(ENVIRONMENT).optional(),
  cursor: z.string().regex(CURSOR).optional(),
}).strict();

export type SentryWorkspaceFilters = z.infer<typeof sentryFiltersSchema>;

type Configuration = {
  public: SentryConfiguration;
  base: string;
  token: string | undefined;
  dsnProjects: string[];
  state: "ready" | "setup_required" | "invalid_config";
};

class SentryFailure extends Error {
  constructor(readonly connection: SentryConnection) {
    super(connection);
  }
}

/**
 * Error summaries can contain URLs, submitted emails and credentials. This
 * intentionally sacrifices URL detail; full event context remains in Sentry.
 */
export function scrubSentrySummary(value: string, maxLength = 240): string {
  let summary = value.slice(0, 8_000);
  // A token pasted verbatim into an error may not have an identifying prefix.
  for (const credential of [process.env.SENTRY_READ_AUTH_TOKEN, process.env.SENTRY_AUTH_TOKEN]) {
    if (credential?.trim()) summary = summary.split(credential.trim()).join("[redacted credential]");
  }
  return summary
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/(?:https?|wss?|ftp):\/\/[^\s<>"'`]+/gi, "[redacted URL]")
    .replace(/\b(?:Bearer|Basic)\s+[a-zA-Z0-9._~+/=-]+/gi, "[redacted credential]")
    .replace(/\b(?:sntrys|sntryu|sntryd)_[a-zA-Z0-9_-]+\b/gi, "[redacted credential]")
    .replace(/\b(?:sk|pk)-[a-zA-Z0-9_-]{16,}\b/g, "[redacted credential]")
    .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, "[redacted credential]")
    .replace(/\b(?:authorization|cookie|set-cookie|x-api-key|api[_-]?key|password|passwd|secret|token|access[_-]?token|refresh[_-]?token|client[_-]?secret)["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^,;]+)/gi, "[redacted credential]")
    .replace(/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[redacted email]")
    .replace(/[?#][^\s<>"'`]+/g, "[redacted parameters]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function configured(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function dsnProject(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || !url.username || url.password || url.search || url.hash) return null;
    const id = url.pathname.match(/\/(\d{1,30})\/?$/)?.[1];
    return id ?? null;
  } catch {
    return null;
  }
}

function readConfiguration(): Configuration {
  const org = configured(process.env.SENTRY_ORG);
  const project = configured(process.env.SENTRY_PROJECT);
  const rawRegion = configured(process.env.SENTRY_REGION) ?? "us";
  const region = rawRegion === "eu" ? "eu" : "us";
  // This credential is deliberately separate from the source-map upload token.
  const token = configured(process.env.SENTRY_READ_AUTH_TOKEN);
  const dsns = [configured(process.env.NEXT_PUBLIC_SENTRY_DSN), configured(process.env.SENTRY_DSN)].filter((value): value is string => Boolean(value));
  const dsnProjects = dsns.map(dsnProject);
  const validOrg = org && SLUG.test(org) ? org : null;
  const validProject = project && SLUG.test(project) ? project : null;
  const invalid = Boolean(
    (org && !validOrg) || (project && !validProject) || !["us", "eu"].includes(rawRegion)
    || (token && (!/^[\x21-\x7e]{1,4096}$/.test(token))) || dsnProjects.some((id) => id === null),
  );
  const enabled = sentryEnabled();
  const browserDsnConfigured = Boolean(configured(process.env.NEXT_PUBLIC_SENTRY_DSN));
  return {
    base: region === "eu" ? "https://de.sentry.io" : "https://sentry.io",
    token,
    dsnProjects: dsnProjects.filter((value): value is string => value !== null),
    state: invalid ? "invalid_config" : !validOrg || !validProject || !token ? "setup_required" : "ready",
    public: {
      sdkEnabled: enabled,
      browserEnabled: enabled && browserDsnConfigured,
      dsnConfigured: Boolean(sentryDsn()),
      browserDsnConfigured,
      environment: scrubSentrySummary(sentryEnvironment(), 64) || "unknown",
      release: sentryRelease() ? scrubSentrySummary(sentryRelease()!, 120) || null : null,
      tracesSampleRate: sentryTracesSampleRate(),
      replaySessionSampleRate: sentryReplaySessionSampleRate(),
      replayOnErrorSampleRate: sentryReplayErrorSampleRate(),
      organization: validOrg,
      project: validProject,
      readTokenConfigured: Boolean(token),
      sourceMaps: process.env.SENTRY_UPLOAD_SOURCE_MAPS === "false" ? "disabled"
        : validOrg && validProject && Boolean(process.env.SENTRY_AUTH_TOKEN) ? "configured" : "unverified",
      region,
    },
  };
}

function dashboardLinks(config: Configuration, projectId: string | null = null): SentryLinks {
  const empty: SentryLinks = { issues: null, performance: null, replays: null, releases: null, alerts: null, settings: null, projectKeys: null };
  const { organization, project } = config.public;
  if (!organization || !project || config.state === "invalid_config") return empty;
  const settings = `${config.base}/settings/${organization}/projects/${project}/`;
  // Project settings are safe to link before verification. Data views require
  // the verified project ID, so they cannot accidentally show every project.
  const links = { ...empty, settings, projectKeys: `${settings}keys/` };
  if (!projectId) return links;
  const workspace = `${config.base}/organizations/${organization}`;
  const query = `?project=${encodeURIComponent(projectId)}`;
  return {
    ...links,
    issues: `${workspace}/issues/${query}`,
    performance: `${workspace}/insights/${query}`,
    replays: `${workspace}/replays/${query}`,
    releases: `${workspace}/releases/${query}`,
    alerts: `${workspace}/alerts/rules/${query}`,
  };
}

/** Bounds the entire project verification + issue request, including bodies. */
async function bounded<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new SentryFailure("unavailable"));
    }, TIMEOUT_MS);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => work(controller.signal)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(url: URL, token: string, signal: AbortSignal): Promise<{ data: unknown; links: string | null }> {
  const response = await fetch(url.href, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
    redirect: "error",
    signal,
  });
  if (!response.ok) {
    // Error bodies often contain submitted data; do not parse or forward them.
    void response.body?.cancel().catch(() => {});
    const status = response.status;
    throw new SentryFailure(status === 401 ? "unauthorized" : status === 403 ? "forbidden" : status === 429 ? "rate_limited" : "unavailable");
  }
  if (!response.body || Number(response.headers.get("content-length")) > MAX_BODY_BYTES) {
    void response.body?.cancel().catch(() => {});
    throw new SentryFailure("unavailable");
  }
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  let size = 0;
  let text = "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) {
      if (signal.aborted) throw new SentryFailure("unavailable");
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BODY_BYTES) {
        cancel();
        throw new SentryFailure("unavailable");
      }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    return { data: JSON.parse(text), links: response.headers.get("link") };
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

const providerId = z.union([z.string().regex(ID), z.number().int().nonnegative().safe().transform(String)]);
const projectSchema = z.object({
  id: providerId,
  slug: z.string().optional(),
  organization: z.object({ slug: z.string() }).optional(),
});
const issueSchema = z.object({
  id: providerId,
  shortId: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/),
  title: z.string().max(100_000),
  culprit: z.string().max(100_000).nullish(),
  level: z.string().optional(),
  status: z.enum(["unresolved", "resolved", "ignored"]),
  count: z.union([z.number(), z.string()]).nullish(),
  userCount: z.union([z.number(), z.string()]).nullish(),
  firstSeen: z.string().nullish(),
  lastSeen: z.string().nullish(),
  project: z.object({ id: providerId, slug: z.string().optional() }).optional(),
});

function count(value: string | number | null | undefined): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+$/.test(value))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function date(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function nextCursor(header: string | null): string | null {
  if (!header || header.length > 16_384) return null;
  for (const item of header.split(/,(?=\s*<)/)) {
    if (!/;\s*rel="next"(?:;|\s*$)/i.test(item) || !/;\s*results="true"(?:;|\s*$)/i.test(item)) continue;
    // Never follow the URL supplied by the upstream Link header.
    const cursor = item.match(/;\s*cursor="([^"]+)"(?:;|\s*$)/i)?.[1];
    return cursor && CURSOR.test(cursor) ? cursor : null;
  }
  return null;
}

function snapshot(config: Configuration, filters: SentryWorkspaceFilters, connection: SentryConnection): SentryWorkspaceSnapshot {
  return {
    checkedAt: new Date().toISOString(),
    connection,
    configuration: config.public,
    links: dashboardLinks(config),
    issues: [],
    nextCursor: null,
    filters: { status: filters.status, period: filters.period, environment: filters.environment ?? null },
  };
}

async function loadWorkspace(config: Configuration, filters: SentryWorkspaceFilters): Promise<SentryWorkspaceSnapshot> {
  try {
    return await bounded(async (signal) => {
      const { organization, project } = config.public;
      const projectUrl = new URL(`/api/0/projects/${organization}/${project}/`, config.base);
      const metadata = projectSchema.safeParse((await readJson(projectUrl, config.token!, signal)).data);
      if (!metadata.success) throw new SentryFailure("unavailable");
      const projectId = metadata.data.id;
      if ((metadata.data.slug && metadata.data.slug !== project)
        || (metadata.data.organization && metadata.data.organization.slug !== organization)
        || config.dsnProjects.some((id) => id !== projectId)) throw new SentryFailure("project_mismatch");

      const issuesUrl = new URL(`/api/0/organizations/${organization}/issues/`, config.base);
      issuesUrl.searchParams.set("project", projectId);
      issuesUrl.searchParams.set("query", `is:${filters.status}`);
      issuesUrl.searchParams.set("statsPeriod", filters.period);
      issuesUrl.searchParams.set("limit", "20");
      if (filters.environment) issuesUrl.searchParams.set("environment", filters.environment);
      if (filters.cursor) issuesUrl.searchParams.set("cursor", filters.cursor);
      const response = await readJson(issuesUrl, config.token!, signal);
      const parsed = z.array(issueSchema).max(20).safeParse(response.data);
      if (!parsed.success) throw new SentryFailure("unavailable");
      if (parsed.data.some((issue) => issue.project && (issue.project.id !== projectId || (issue.project.slug && issue.project.slug !== project)))) {
        throw new SentryFailure("project_mismatch");
      }
      const issues: SentryIssue[] = parsed.data.map((issue) => ({
        id: issue.id,
        shortId: scrubSentrySummary(issue.shortId, 64),
        title: scrubSentrySummary(issue.title) || "Error",
        location: issue.culprit ? scrubSentrySummary(issue.culprit) || null : null,
        level: ["fatal", "error", "warning", "info", "debug"].includes(issue.level ?? "") ? issue.level as SentryIssue["level"] : "unknown",
        status: issue.status,
        events: count(issue.count),
        users: count(issue.userCount),
        firstSeen: date(issue.firstSeen),
        lastSeen: date(issue.lastSeen),
        url: `${config.base}/organizations/${organization}/issues/${issue.id}/`,
      }));
      return { ...snapshot(config, filters, "connected"), issues, links: dashboardLinks(config, projectId), nextCursor: nextCursor(response.links) };
    });
  } catch (cause) {
    return snapshot(config, filters, cause instanceof SentryFailure ? cause.connection : "unavailable");
  }
}

type CacheEntry = { expiresAt: number; result?: SentryWorkspaceSnapshot; pending?: Promise<SentryWorkspaceSnapshot> };
const cache = new Map<string, CacheEntry>();

/** Call only after withAdmin/requireAdmin. Every HTTP request rechecks auth. */
export async function getSentryWorkspace(filters: SentryWorkspaceFilters): Promise<SentryWorkspaceSnapshot> {
  const validated = sentryFiltersSchema.safeParse(filters);
  const config = readConfiguration();
  if (!validated.success) throw new SentryFailure("invalid_config");
  if (config.state !== "ready") return snapshot(config, validated.data, config.state);
  // Rotating credentials/configuration invalidates data without storing tokens
  // in cache keys. The cache never stores a session or an authorization result.
  const key = createHash("sha256").update(JSON.stringify({
    token: config.token, configuration: config.public, dsns: config.dsnProjects, filters: validated.data,
  })).digest("hex");
  const existing = cache.get(key);
  if (existing?.pending) return existing.pending;
  if (existing?.result && existing.expiresAt > Date.now()) return existing.result;
  cache.delete(key);
  while (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
  const entry: CacheEntry = { expiresAt: 0 };
  entry.pending = loadWorkspace(config, validated.data).then((result) => {
    entry.result = result;
    entry.expiresAt = Date.now() + CACHE_MS;
    delete entry.pending;
    return result;
  });
  cache.set(key, entry);
  return entry.pending;
}
