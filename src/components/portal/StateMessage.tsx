"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The shared body for an error or not-found segment.
 *
 * Deliberately says nothing about *why* it failed: no message, no stack, no
 * database text (plan §52). The digest is a hash Next.js already logs
 * server-side, so quoting it gives support something to search without
 * revealing anything about the failure.
 */
export default function StateMessage({
  title,
  body,
  digest,
  onRetry,
  backHref,
  backLabel,
}: {
  title: string;
  body: string;
  digest?: string;
  onRetry?: () => void;
  backHref?: string;
  backLabel?: string;
}) {
  const t = useTranslations("common");

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-16">
      <div className="max-w-md space-y-4 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/[0.07]">
          <AlertTriangle className="size-5 text-amber-300" aria-hidden />
        </span>

        <div className="space-y-2">
          <h1 className="font-satoshi text-lg text-white">{title}</h1>
          <p className="text-sm leading-relaxed text-slate-400">{body}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw className="size-3.5" aria-hidden />
              {t("retry")}
            </Button>
          )}

          {backHref && backLabel && (
            <Link href={backHref} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              {backLabel}
            </Link>
          )}
        </div>

        {digest && <p className="text-xs text-slate-600">{t("errorReference", { id: digest })}</p>}
      </div>
    </div>
  );
}
