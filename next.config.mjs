/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The embedded Postgres (used when DATABASE_URL isn't set) ships WASM that must not be bundled.
  experimental: {
    serverComponentsExternalPackages: ["@electric-sql/pglite"],
    // The Excel timesheet fills in this template at request time, so it must ship with the function.
    outputFileTracingIncludes: { "/api/export/excel": ["./assets/**/*"] },
  },
  // Real HTTP redirects (no client-side JavaScript involved), so visiting the bare address can't crash on hydration.
  async redirects() {
    return [
      { source: "/", destination: "/engineer", permanent: false },
      { source: "/services", destination: "/tasks", permanent: false },
      { source: "/settings", destination: "/customers", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] }];
  },
};

export default nextConfig;
