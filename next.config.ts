import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is only needed for the Electron production build.
  // Enabling it during normal dev/web builds breaks better-sqlite3 under Turbopack.
  ...(process.env.ELECTRON_BUILD === "true" ? { output: "standalone" } : {}),

  // Prevent bundling of native/CJS-only packages — works for both Turbopack and webpack
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "mammoth"],

  webpack: (config) => {
    // Kept for non-Turbopack builds (e.g. `next build`)
    config.externals.push({
      "better-sqlite3": "commonjs better-sqlite3",
      "pdf-parse": "commonjs pdf-parse",
      "mammoth": "commonjs mammoth",
    });
    return config;
  },
};

export default nextConfig;
