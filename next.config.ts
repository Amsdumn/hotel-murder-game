import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.1.14"],
  images: { qualities: [65, 75] },
};

export default nextConfig;
