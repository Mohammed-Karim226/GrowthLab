export type ServiceStatus = "operational" | "configured" | "degraded" | "unavailable" | "unconfigured" | "unknown" | "disabled";

export type ServiceId = "application" | "database" | "auth" | "storage" | "gemini" | "inngest" | "sentry" | "credentials";

export type ServiceHealth = {
  id: ServiceId;
  status: ServiceStatus;
  check: "live" | "configuration";
  detail: "responding" | "reachable" | "modelAvailable" | "missingConfig" | "invalidConfig" | "checkFailed" | "timedOut" | "rateLimited" | "accessDenied" | "configuredOnly" | "development" | "privateBucket" | "publicBucket" | "encryptionReady" | "monitoringDisabled";
  latencyMs: number | null;
  dashboardUrl: string | null;
};

/** Aggregated from individual provider attempts; never inferred from report rows. */
export type AiUsageSummary = {
  since: string;
  requests: number;
  succeeded: number;
  failed: number;
  rateLimited: number;
  tokens: number;
  tokenSamples: number;
  averageLatencyMs: number | null;
  models: Array<{
    model: string;
    requests: number;
    failed: number;
    tokens: number;
    tokenSamples: number;
    minuteRequests: number;
    minuteInputTokens: number;
    minuteTokenSamples: number;
    dayRequests: number;
  }>;
  hourly: Array<{ hour: string; requests: number; failed: number }>;
};

export type ModelQuota = {
  model: string;
  active: boolean;
  requestsPerMinute: number | null;
  inputTokensPerMinute: number | null;
  requestsPerDay: number | null;
};

export type SystemSnapshot = {
  checkedAt: string;
  environment: "production" | "preview" | "development";
  services: ServiceHealth[];
  usage: AiUsageSummary | null;
  usageStatus: "available" | "setup_required" | "unavailable";
  quotas: ModelQuota[];
  jobs: {
    queued: number;
    running: number;
    failed: number;
    recent: Array<{ id: string; status: string; createdAt: string; completedAt: string | null; errorKey: string | null }>;
  } | null;
};
