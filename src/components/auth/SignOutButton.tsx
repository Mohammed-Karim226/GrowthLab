"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/** Signs out server-side, then hard-refreshes so no cached RSC payload lingers. */
export default function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      await apiPost("/api/auth/logout");
    } finally {
      router.replace(`/${locale}`);
      router.refresh();
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={handleSignOut}
      className={cn("border-white/10 bg-white/[0.02] text-slate-300", className)}
    >
      <LogOut className="size-3.5" aria-hidden />
      {t("signOut")}
    </Button>
  );
}
