"use strict";

// Preload runs in a sandboxed context with contextIsolation: true.
// Expose only what the renderer actually needs via contextBridge.
// Currently nothing is needed — the app communicates with Next.js via HTTP.
