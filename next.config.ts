import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
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

export default withNextIntl(nextConfig);
