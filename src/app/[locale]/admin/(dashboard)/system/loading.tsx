import { getTranslations } from "next-intl/server";

export default async function SystemLoading() {
  const t = await getTranslations("common");

  return (
    <div role="status" aria-label={t("loading")} className="space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden className="space-y-6 motion-safe:animate-pulse">
        <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.035] p-6 sm:p-8">
          <div className="h-3 w-28 rounded bg-[#d8be78]/20" />
          <div className="mt-4 h-9 w-64 max-w-full rounded-lg bg-white/[0.08]" />
          <div className="mt-4 h-4 w-[30rem] max-w-full rounded bg-white/[0.05]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-5"
            >
              <div className="h-3 w-24 rounded bg-white/[0.05]" />
              <div className="mt-4 h-8 w-20 rounded bg-white/[0.08]" />
              <div className="mt-3 h-3 w-36 max-w-full rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          {[6, 3].map((rows, index) => (
            <div
              key={index}
              className="space-y-4 rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-6"
            >
              <div className="mb-6 h-5 w-40 rounded bg-white/[0.08]" />
              {Array.from({ length: rows }, (_, row) => (
                <div
                  key={row}
                  className="h-16 rounded-2xl border border-white/[0.04] bg-white/[0.025]"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
