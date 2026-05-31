import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/providers/Providers";

export const metadata: Metadata = {
  title: "GrowthLab | YouTube Growth Strategy",
  description: "A modern YouTube growth landing page built with Next.js, Tailwind CSS, and Framer Motion.",
  openGraph: {
    title: "GrowthLab | YouTube Growth Strategy",
    description: "A modern YouTube growth landing page built with Next.js.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
