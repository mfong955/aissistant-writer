"use strict";

const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const crypto = require("crypto");

const isDev = !app.isPackaged;

let mainWindow = null;
let nextProcess = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function waitForServer(port, maxMs = 30_000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + maxMs;
    function attempt() {
      http
        .get(`http://localhost:${port}`, () => resolve())
        .on("error", () => {
          if (Date.now() > deadline) {
            reject(new Error("Next.js server did not start within 30 s"));
          } else {
            setTimeout(attempt, 500);
          }
        });
    }
    attempt();
  });
}

function getOrCreateKey(dataDir) {
  const keyFile = path.join(dataDir, "encryption.key");
  if (fs.existsSync(keyFile)) {
    return fs.readFileSync(keyFile, "utf8").trim();
  }
  const key = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(keyFile, key, { mode: 0o600 });
  return key;
}

function findNodeBinary() {
  const candidates = [
    "/opt/homebrew/bin/node", // Apple Silicon Homebrew
    "/usr/local/bin/node",   // Intel Homebrew / nvm default
    "/usr/bin/node",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    const { execSync } = require("child_process");
    return execSync("which node", { encoding: "utf8", env: process.env }).trim();
  } catch {
    return null;
  }
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "Aissistant Writer",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL("http://localhost:3000");

  // Open external links in the system browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── Production server ─────────────────────────────────────────────────────────

async function startProductionServer() {
  const dataDir = app.getPath("userData");
  const encryptionKey = getOrCreateKey(dataDir);

  const nodeBin = findNodeBinary();
  if (!nodeBin) {
    dialog.showErrorBox(
      "Node.js not found",
      "Aissistant Writer requires Node.js to be installed. Please install it from nodejs.org and restart the app."
    );
    app.quit();
    return;
  }

  // electron-builder places extraResources at process.resourcesPath
  const serverJs = path.join(process.resourcesPath, "server", "server.js");

  if (!fs.existsSync(serverJs)) {
    dialog.showErrorBox(
      "App bundle error",
      `Could not find the server bundle at:\n${serverJs}\n\nTry reinstalling the app.`
    );
    app.quit();
    return;
  }

  const env = {
    ...process.env,
    PORT: "3000",
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    DATA_DIR: dataDir,
    DB_PATH: path.join(dataDir, "database.db"),
    ENCRYPTION_KEY: encryptionKey,
  };

  nextProcess = spawn(nodeBin, [serverJs], { env, stdio: "pipe" });
  nextProcess.stdout?.on("data", (d) => console.log("[next]", d.toString().trimEnd()));
  nextProcess.stderr?.on("data", (d) => console.error("[next]", d.toString().trimEnd()));
  nextProcess.on("error", (err) => console.error("[next spawn error]", err));

  await waitForServer(3000);
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    if (isDev) {
      await waitForServer(3000);
    } else {
      await startProductionServer();
    }
    createWindow();
  } catch (err) {
    dialog.showErrorBox("Startup error", String(err));
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  nextProcess?.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  nextProcess?.kill();
});
