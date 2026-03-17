import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    'localhost',
    'localhost:3000',
    'localhost:81',
    '21.0.12.178',
    '21.0.12.178:3000',
    '21.0.12.178:81',
    '.z.ai',
    '.space.z.ai',
    '*.z.ai',
    '*.space.z.ai',
  ],
};

export default nextConfig;
