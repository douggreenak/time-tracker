/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The embedded Postgres (used when DATABASE_URL isn't set) ships WASM that must not be bundled.
  experimental: {
    serverComponentsExternalPackages: ["@electric-sql/pglite"],
  },
};

export default nextConfig;
