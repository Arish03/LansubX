/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: "http://backend:8000/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
