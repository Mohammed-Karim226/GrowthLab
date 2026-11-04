import type { SystemIssue, SystemSnapshot } from "@/types/admin-system";
import type { SentryWorkspaceSnapshot } from "@/types/sentry";

/** Derive attention from observed failures as well as endpoint reachability. */
export function collectSystemIssues(snapshot: Omit<SystemSnapshot, "issues">, sentry: SentryWorkspaceSnapshot): SystemIssue[] {
  const issues: SystemIssue[] = [];
  for (const service of snapshot.services) {
    if (!["degraded", "unavailable", "unconfigured", "unknown", "disabled"].includes(service.status)) continue;
    issues.push({ id: `service:${service.id}`, kind: "service", service: service.id, detail: service.detail,
      severity: service.status === "unavailable" ? "error" : "warning",
      href: service.id === "sentry" ? "/admin/system?tab=sentry" : service.dashboardUrl ?? "#system-services" });
  }
  if (snapshot.usageStatus !== "available") {
    issues.push({ id: "usage", kind: snapshot.usageStatus === "setup_required" ? "usageSetup" : "usageUnavailable", severity: "warning", href: "#system-usage" });
  }
  if (snapshot.usage?.failed) issues.push({ id: "aiFailures", kind: "aiFailures", count: snapshot.usage.failed, severity: "error", href: "#system-ai-activity" });
  if (snapshot.usage?.rateLimited) issues.push({ id: "rateLimits", kind: "rateLimits", count: snapshot.usage.rateLimited, severity: "warning", href: "https://aistudio.google.com/usage" });
  if (!snapshot.jobs) issues.push({ id: "jobsUnavailable", kind: "jobsUnavailable", severity: "warning", href: "#system-jobs" });
  else {
    for (const [kind, count] of [["jobFailures", snapshot.jobs.failed], ["queuedStalled", snapshot.jobs.stalledQueued], ["runningStalled", snapshot.jobs.stalledRunning]] as const) {
      if (count) issues.push({ id: kind, kind, count, severity: "error", href: "#system-jobs" });
    }
  }
  if (sentry.connection === "connected" && sentry.issues.length) {
    issues.push({ id: "sentryIssues", kind: "sentryIssues", count: sentry.issues.length, severity: "error", href: "/admin/system?tab=sentry" });
  }
  for (const quota of snapshot.quotas) {
    const usage = snapshot.usage?.models.find((entry) => entry.model === quota.model);
    if (!usage) continue;
    const metrics = [
      ["requestsMinute", usage.minuteRequests, quota.requestsPerMinute],
      ["tokensMinute", usage.minuteTokenSamples === usage.minuteRequests ? usage.minuteInputTokens : null, quota.inputTokensPerMinute],
      ["requestsDay", usage.dayRequests, quota.requestsPerDay],
    ] as const;
    for (const [metric, used, limit] of metrics) {
      if (used === null || limit === null || used / limit < 0.8) continue;
      issues.push({ id: `quota:${quota.model}:${metric}`, kind: "quota", model: quota.model, metric,
        severity: used >= limit ? "error" : "warning", href: "#system-quota" });
    }
  }
  return issues.sort((a, b) => Number(b.severity === "error") - Number(a.severity === "error"));
}
