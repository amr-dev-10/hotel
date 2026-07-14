import type { NextConfig } from "next";
import path from "node:path";

const apiProxyTarget = process.env.API_PROXY_TARGET ?? process.env.API_INTERNAL_BASE_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiProxyTarget}/api/v1/:path*`,
      },
      {
        source: "/media/:path*",
        destination: `${apiProxyTarget}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
