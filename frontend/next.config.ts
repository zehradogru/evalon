import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel'de full Next.js features aktif
  images: {
    unoptimized: false, // Vercel Image Optimization kullanılacak
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/prices',
        destination: 'https://evalon-mu.vercel.app/v1/prices',
      },
    ]
  },
};

export default nextConfig;
