import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Include the SQLite DB file in the serverless function bundle
  outputFileTracingIncludes: {
    "/api/**": ["./db/aldi.db"],
  },
};

export default nextConfig;
