import "server-only";

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";
import {
  followerTotals,
  type FollowerMetric,
  type TestimonialFollowers,
  type TestimonialKey,
} from "./followers";
import type { Database } from "@/types/database";

// Only these existing public testimonials may expose their audience totals.
// Names are exact, case-insensitive matches; ambiguous matches are left empty.
const creators: Record<TestimonialKey, readonly string[]> = {
  mosewilam: ["MoSewilam", "Mo Sewilam"],
  "omar-jehad": ["Omar Jehad"],
  "mohammed-rifaat": ["Mohammed Rifaat", "Mohamed Rifaat"],
  mind: ["مايند | Mind", "Mind", "مايند"],
};

type ClientIdentity = { id: string; name: string; company_name: string | null };
type LatestReport = { id: string; current_published_version_id: string };
type SavedFollowerMetric = Omit<FollowerMetric, "accountId"> & {
  insight_batches: { account_id: string | null };
};

async function readTestimonialFollowers(): Promise<TestimonialFollowers> {
  // This dedicated server client reads only the curated public follower data.
  // No service key, private report content or client identifiers leave here.
  const db = createClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const aliases = Object.values(creators).flat();
  const { data: clients, error } = await db.from("clients")
    .select("id, name, company_name")
    .eq("is_active", true)
    .or(aliases.flatMap((name) => [`name.ilike.${name}`, `company_name.ilike.${name}`]).join(","))
    .returns<ClientIdentity[]>();
  if (error) throw error;

  const result: TestimonialFollowers = {};
  await Promise.all(Object.entries(creators).map(async ([key, names]) => {
    const normalized = names.map((name) => name.toLowerCase());
    const matches = (clients ?? []).filter((client) =>
      [client.name, client.company_name].some((name) =>
        name !== null && normalized.includes(name.toLowerCase()),
      ),
    );
    if (matches.length !== 1) return;

    const { data: report, error: reportError } = await db.from("reports")
      .select("id, current_published_version_id")
      .eq("client_id", matches[0].id)
      .not("current_published_version_id", "is", null)
      .order("period_end", { ascending: false })
      .order("id", { ascending: false })
      .limit(1).maybeSingle<LatestReport>();
    if (reportError) throw reportError;
    if (!report) return;

    const saved: SavedFollowerMetric[] = [];
    let offset = 0;
    while (true) {
      const { data: metrics, error: metricError, count } = await db.from("metrics")
        .select("id, platform, metric_name, metric_value, metric_date, updated_at, needs_review, insight_batches!inner(account_id, insight_images!inner(id)), report_versions!inner(status, report_id)", { count: "exact" })
        .eq("report_version_id", report.current_published_version_id)
        .eq("report_versions.report_id", report.id)
        .eq("report_versions.status", "published")
        .eq("needs_review", false)
        .in("metric_name", ["followers", "subscribers"])
        .order("id", { ascending: true })
        .range(offset, offset + 199)
        .returns<SavedFollowerMetric[]>();
      if (metricError) throw metricError;
      if (count === null || count === undefined || (!metrics?.length && offset < count)) {
        throw new Error("Incomplete testimonial follower metrics");
      }
      saved.push(...(metrics ?? []));
      offset += metrics?.length ?? 0;
      if (offset >= count) break;
    }
    result[key as TestimonialKey] = followerTotals(saved.map((metric) => ({
      ...metric,
      accountId: metric.insight_batches.account_id,
    })));
  }));
  return result;
}

const cachedFollowers = unstable_cache(readTestimonialFollowers, ["testimonial-followers"], {
  revalidate: 60,
});

export async function loadTestimonialFollowers(): Promise<TestimonialFollowers> {
  if (!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) ||
    !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)) return {};
  try {
    return await cachedFollowers();
  } catch {
    console.warn("Testimonial follower analytics are unavailable.");
    return {};
  }
}
