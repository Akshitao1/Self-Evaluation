import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Lint separately; don't fail the Vercel build on lint.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
