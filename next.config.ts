import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.tiktokcdn.com',
      },
      {
        protocol: 'https',
        hostname: '*.tiktokcdn-us.com',
      },
      {
        protocol: 'https',
        hostname: 'p16-sign*.tiktokcdn.com',
      },
      {
        protocol: 'https',
        hostname: 'p77-sign*.tiktokcdn.com',
      },
    ],
  },
};

export default nextConfig;
