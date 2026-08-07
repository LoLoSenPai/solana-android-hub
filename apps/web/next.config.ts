import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@hub/api-client", "@hub/config", "@hub/database", "@hub/domain", "@hub/solana", "@hub/validation"]
};

export default nextConfig;
