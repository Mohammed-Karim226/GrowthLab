import type { Metadata } from "next";

import AdminShell from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/auth";

// Every admin page reads the live session; nothing here may be prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Server-side guard. The proxy redirect is a convenience; this is the gate.
  const session = await requireAdmin(locale);

  return (
    <AdminShell
      adminName={session.profile.full_name ?? "GrowthLab"}
      adminEmail={session.email}
    >
      {children}
    </AdminShell>
  );
}
