import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "yt3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "yt3.ggpht.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "scontent-*.xx.fbcdn.net",
      },
      {
        protocol: "https",
        hostname: "scontent-*.fbcdn.net",
      },
      {
        protocol: "https",
        hostname: "instagram.f*.fna.fbcdn.net",
      },
      {
        protocol: "https",
        hostname: "p16-sign.tiktokcdn-us.com",
      },
      {
        protocol: "https",
        hostname: "p16-sign-va.tiktokcdn.com",
      },
      {
        protocol: "https",
        hostname: "*.tiktokcdn.com",
      },
    ],
  },
};

// Upload only from builds with all three server-only credentials configured.
// The explicit opt-out also keeps verification builds offline when credentials
// are available through the local Sentry build-plugin environment file.
const uploadSourceMaps = process.env.SENTRY_UPLOAD_SOURCE_MAPS !== "false"
  && Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);

export default withSentryConfig(createNextIntlPlugin()(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: {
    disable: !uploadSourceMaps,
    deleteSourcemapsAfterUpload: true,
  },
  release: {
    name: process.env.SENTRY_RELEASE || undefined,
    create: uploadSourceMaps,
    finalize: uploadSourceMaps,
  },
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },
});
