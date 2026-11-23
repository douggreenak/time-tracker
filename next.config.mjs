/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The embedded Postgres (used when DATABASE_URL isn't set) ships WASM that must not be bundled.
  experimental: {
    serverComponentsExternalPackages: ["@electric-sql/pglite"],
    // The Excel timesheet fills in this template at request time, so it must ship with the function.
    outputFileTracingIncludes: { "/api/export/excel": ["./assets/**/*"] },
  },
};

export default nextConfig;
