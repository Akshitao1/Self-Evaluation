import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: "/user/v1/:path*",
        destination:
          "http://fna-heimdall.prod.joveo.com:8080/user/v1/:path*", // Proxy to Heimdall
      },
    ];
  },
  // Disable ESLint checks during production builds to speed up CI/CD
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;