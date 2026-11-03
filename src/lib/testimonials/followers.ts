import type { Platform } from "@/types/database";

export type TestimonialKey = "mosewilam" | "omar-jehad" | "mohammed-rifaat" | "mind";
export type PlatformFollowers = Record<Platform, number | null>;
export type TestimonialFollowers = Partial<Record<TestimonialKey, PlatformFollowers>>;
export type PlatformFollowerGrowth = {
  days: number;
  fromLaunch?: boolean;
  illustrative?: boolean;
  before: PlatformFollowers;
  after: PlatformFollowers;
};

export type FollowerMetric = {
  id: string;
  platform: Platform;
  metric_name: string;
  metric_value: number | null;
  metric_date: string | null;
  updated_at: string;
  needs_review: boolean;
  accountId: string | null;
};

export function emptyPlatformFollowers(): PlatformFollowers {
  return { instagram: null, facebook: null, tiktok: null, youtube: null };
}

/** Audience counts are snapshots: use the latest reading once per account. */
export function followerTotals(metrics: FollowerMetric[]): PlatformFollowers {
  const totals = emptyPlatformFollowers();
  const accounts = new Map<string, Map<string, FollowerMetric>>();
  const newestFirst = [...metrics].sort((a, b) =>
    (b.metric_date ?? "").localeCompare(a.metric_date ?? "") ||
    b.updated_at.localeCompare(a.updated_at) || b.id.localeCompare(a.id),
  );

  for (const metric of newestFirst) {
    if (metric.needs_review || metric.metric_value === null ||
      !Number.isFinite(metric.metric_value) || metric.metric_value < 0) continue;
    if (metric.metric_name !== "followers" &&
      !(metric.platform === "youtube" && metric.metric_name === "subscribers")) continue;

    const key = `${metric.platform}:${metric.accountId ?? "default"}`;
    const readings = accounts.get(key) ?? new Map<string, FollowerMetric>();
    if (!readings.has(metric.metric_name)) readings.set(metric.metric_name, metric);
    accounts.set(key, readings);
  }

  for (const readings of accounts.values()) {
    // YouTube's followers/subscribers describe the same audience, not two totals.
    const metric = readings.get("subscribers") ?? readings.get("followers");
    if (!metric || metric.metric_value === null) continue;
    totals[metric.platform] = (totals[metric.platform] ?? 0) + metric.metric_value;
  }
  return totals;
}
