"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiRequestError, apiFetch } from "@/lib/api-client";
import type { RevealedGmailCredentials } from "@/types/credentials";
import type { ClientGmailRow } from "@/types/database";

/** Mounted only while open, so closing also discards the revealed passwords. */
export default function GmailPasswordRevealDialog({ account, onClose }: {
  account: ClientGmailRow;
  onClose: () => void;
}) {
  const t = useTranslations("auth.gmail");
  const tErrors = useTranslations("admin.errors");
  const [credentials, setCredentials] = useState<RevealedGmailCredentials | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch<{ credentials: RevealedGmailCredentials }>(`/api/admin/gmail-accounts/${account.id}/reveal`, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
    }).then(({ credentials: revealed }) => {
      if (!controller.signal.aborted) setCredentials(revealed);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setErrorKey(cause instanceof ApiRequestError ? cause.errorKey : "serverError");
    });
    return () => controller.abort();
  }, [account.id]);

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("passwordsTitle")}</DialogTitle>
        <DialogDescription><span dir="ltr">{account.email}</span></DialogDescription>
      </DialogHeader>
      {!credentials && !errorKey && <p role="status">{t("loadingPasswords")}</p>}
      {errorKey && <p role="alert">{tErrors(errorKey as never)}</p>}
      {credentials && <div className="space-y-4">
        <label className="block space-y-2">
          <span>{t("passwordPlaceholder")}</span>
          <Input dir="ltr" type="text" readOnly autoComplete="off" className="font-mono" value={credentials.password} />
        </label>
        {credentials.relatedAccounts.length > 0 && <p>{t("related")}</p>}
        {credentials.relatedAccounts.map((related) => <label key={related.id} className="block space-y-2">
          <span><bdi>{related.service}</bdi> / <bdi>{related.username}</bdi></span>
          <Input dir="ltr" type="text" readOnly autoComplete="off" className="font-mono" value={related.password} />
        </label>)}
      </div>}
      <Button variant="outline" onClick={onClose}>{t("closePasswords")}</Button>
    </DialogContent>
  </Dialog>;
}
