import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is only needed for the Electron production build.
  ...(process.env.ELECTRON_BUILD === "true" ? { output: "standalone" } : {}),

  // Prevent bundling of CJS-only packages — works for both Turbopack and webpack
  serverExternalPackages: ["pdf-parse", "mammoth"],

  webpack: (config) => {
    config.externals.push({
      "pdf-parse": "commonjs pdf-parse",
      "mammoth": "commonjs mammoth",
    });
    return config;
  },
};

export default nextConfig;
