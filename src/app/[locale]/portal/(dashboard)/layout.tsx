import type { Metadata } from "next";

import PortalShell from "@/components/portal/PortalShell";
import { requireClient } from "@/lib/auth";

// Every portal page reads the live session; nothing here may be prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Server-side guard. The proxy redirect is a convenience; this is the gate,
  // and it also asserts the tenant binding every page below depends on.
  const session = await requireClient(locale);

  return (
    <PortalShell
      clientName={session.profile.full_name ?? "GrowthLab"}
      clientEmail={session.email}
    >
      {children}
    </PortalShell>
  );
}
