import createNextIntlPlugin from "next-intl/plugin";

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

export default createNextIntlPlugin()(nextConfig);
