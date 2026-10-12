/** @type {import('next').NextConfig} */
const backendTarget = process.env.BACKEND_INTERNAL_URL || "http://backend:6500";

const nextConfig = {
  reactStrictMode: false,
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${backendTarget}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
