import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/providers/Providers";

export const metadata: Metadata = {
  title: "GrowthLab | Content Distribution & YouTube Growth",
  description:
    "Helping creators and brands expand their reach through strategic content distribution, audience acquisition, and sustainable YouTube growth.",
  openGraph: {
    title: "GrowthLab | Content Distribution & YouTube Growth",
    description:
      "Turn great content into measurable growth with data-driven distribution strategies that increase visibility, engagement, and subscribers.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
