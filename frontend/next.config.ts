import type { NextConfig } from "next";

const EVALON_API_URL =
  process.env.NEXT_PUBLIC_EVALON_API_URL ||
  "https://evalon-backtest-api-r2ffcuqmuq-ew.a.run.app";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "*": ["./next.config.ts"],
  },
  turbopack: {
    root: __dirname,
  },
  images: {
    unoptimized: false,
    qualities: [75, 85],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/prices",
        destination: `${EVALON_API_URL}/v1/prices`,
      },
    ];
  },
  async redirects() {
    return [
      { source: "/analysis", destination: "/backtest", permanent: true },
      { source: "/analysis/:path*", destination: "/backtest", permanent: true },
    ];
  },
};

export default nextConfig;
