"use client";

import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder shown while a dashboard segment streams in.
 *
 * The shapes mirror the real page (header, KPI row, two charts, a list) so the
 * layout does not jump once data arrives. Screen readers get the status text
 * rather than the decorative blocks, which are all `aria-hidden`.
 *
 * Client-side so it picks up the active locale — `loading.tsx` receives no
 * params of its own.
 */
export default function DashboardSkeleton() {
  const t = useTranslations("common");

  return (
    <div className="space-y-10">
      <span role="status" className="sr-only">
        {t("loading")}
      </span>

      <div className="space-y-2.5">
        <Skeleton className="h-3 w-24 bg-white/[0.06]" />
        <Skeleton className="h-8 w-64 bg-white/[0.06]" />
        <Skeleton className="h-3 w-44 bg-white/[0.06]" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-2xl bg-white/[0.04]" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl bg-white/[0.04]" />
        <Skeleton className="h-72 rounded-2xl bg-white/[0.04]" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-40 bg-white/[0.06]" />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      </div>
    </div>
  );
}
