"use strict";

/**
 * Copies Next.js static assets into the standalone server directory so it is
 * fully self-contained before electron-builder packages it.
 *
 *   .next/standalone/         ← server entry + trimmed node_modules
 *   .next/standalone/.next/static/   ← must be copied from .next/static/
 *   .next/standalone/public/         ← must be copied from public/
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

if (!fs.existsSync(standalone)) {
  console.error("ERROR: .next/standalone not found. Run `npm run build` first.");
  process.exit(1);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log("Copying .next/static → .next/standalone/.next/static");
copyDir(
  path.join(root, ".next", "static"),
  path.join(standalone, ".next", "static")
);

console.log("Copying public → .next/standalone/public");
copyDir(path.join(root, "public"), path.join(standalone, "public"));

console.log("Build assets prepared.");
