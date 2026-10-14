export type SentryConnection = "connected" | "setup_required" | "invalid_config" | "unauthorized" | "forbidden" | "rate_limited" | "unavailable" | "project_mismatch";
export type SentryIssueStatus = "unresolved" | "resolved" | "ignored";
export type SentryPeriod = "24h" | "7d" | "14d";

export type SentryIssue = {
  id: string;
  shortId: string;
  title: string;
  location: string | null;
  level: "fatal" | "error" | "warning" | "info" | "debug" | "unknown";
  status: SentryIssueStatus;
  events: number | null;
  users: number | null;
  firstSeen: string | null;
  lastSeen: string | null;
  url: string;
};

export type SentryConfiguration = {
  sdkEnabled: boolean;
  browserEnabled: boolean;
  dsnConfigured: boolean;
  browserDsnConfigured: boolean;
  environment: string;
  release: string | null;
  tracesSampleRate: number;
  replaySessionSampleRate: number;
  replayOnErrorSampleRate: number;
  organization: string | null;
  project: string | null;
  readTokenConfigured: boolean;
  sourceMaps: "configured" | "disabled" | "unverified";
  region: "us" | "eu";
};

export type SentryLinks = Record<"issues" | "performance" | "replays" | "releases" | "alerts" | "settings" | "projectKeys", string | null>;

export type SentryWorkspaceSnapshot = {
  checkedAt: string;
  connection: SentryConnection;
  configuration: SentryConfiguration;
  links: SentryLinks;
  issues: SentryIssue[];
  nextCursor: string | null;
  filters: { status: SentryIssueStatus; period: SentryPeriod; environment: string | null };
};
