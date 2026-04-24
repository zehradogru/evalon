import type { NextConfig } from "next";

const EVALON_API_URL =
  process.env.NEXT_PUBLIC_EVALON_API_URL ||
  "https://evalon-backtest-api-474112640179.europe-west1.run.app";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: false,
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/prices",
        destination: `${EVALON_API_URL}/v1/prices`,
      },
    ];
  },
};

export default nextConfig;
