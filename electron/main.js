// Electron main process for the AccelSuite invoice app.
//
// In production the UI is the same Next.js app, served by its own standalone
// server which we spawn as a child process (using Electron's bundled Node via
// ELECTRON_RUN_AS_NODE) and then load into a BrowserWindow. All the existing
// API routes (PDF generation, Excel read/write) run inside that server.

const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const net = require("net");
const http = require("http");
const { spawn } = require("child_process");

// SMOKE_TEST=1 → boot, confirm the window loads, then quit. Used for headless
// verification during development.
const SMOKE_TEST = process.env.ACCEL_SMOKE_TEST === "1";

let serverProcess = null;
let mainWindow = null;
let serverPort = null;

// Where the built Next standalone server lives. In dev (`electron .`) it's the
// repo's .next/standalone; when packaged it's unpacked under resources.
function standaloneDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "standalone");
  }
  return path.join(__dirname, "..", ".next", "standalone");
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(port, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(
        { host: "127.0.0.1", port, path: "/", timeout: 2000 },
        (res) => {
          res.destroy();
          resolve();
        }
      );
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Next server did not become ready in time"));
        } else {
          setTimeout(tryOnce, 300);
        }
      });
      req.on("timeout", () => req.destroy());
    };
    tryOnce();
  });
}

async function startServer() {
  const dir = standaloneDir();
  const serverJs = path.join(dir, "server.js");
  if (!fs.existsSync(serverJs)) {
    throw new Error(
      `Could not find the app server at ${serverJs}.\n` +
        `Run "npm run app:build" first.`
    );
  }

  const port = await getFreePort();

  // Writable data dir (config + receipts ledger) outside the read-only bundle.
  const dataDir = path.join(app.getPath("userData"), "data");

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    ACCEL_DATA_DIR: dataDir,
    ACCEL_LOGO_PATH: path.join(dir, "public", "logo.png"),
  };

  serverProcess = spawn(process.execPath, [serverJs], {
    cwd: dir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProcess.stdout.on("data", (d) => process.stdout.write(`[next] ${d}`));
  serverProcess.stderr.on("data", (d) => process.stderr.write(`[next] ${d}`));
  serverProcess.on("exit", (code) => {
    if (code && !app.isQuitting) {
      dialog.showErrorBox("Server stopped", `The app server exited (code ${code}).`);
    }
  });

  await waitForServer(port);
  serverPort = port;
  return port;
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    show: !SMOKE_TEST,
    title: "AccelSuite Invoices",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // Open external links in the system browser, not inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  mainWindow.on("closed", () => (mainWindow = null));
  return mainWindow;
}

app.whenReady().then(async () => {
  try {
    const port = await startServer();
    const win = createWindow(port);

    if (SMOKE_TEST) {
      win.webContents.once("did-finish-load", () => {
        console.log(`[smoke] window loaded http://127.0.0.1:${port}/ OK`);
        app.isQuitting = true;
        setTimeout(() => app.quit(), 500);
      });
      win.webContents.once("did-fail-load", (_e, code, desc) => {
        console.error(`[smoke] did-fail-load ${code} ${desc}`);
        app.isQuitting = true;
        app.exit(1);
      });
    }
  } catch (err) {
    dialog.showErrorBox("Startup failed", String(err && err.message ? err.message : err));
    app.exit(1);
  }

  app.on("activate", () => {
    // macOS: recreate a window (reusing the running server) when the dock icon
    // is clicked and no windows are open.
    if (BrowserWindow.getAllWindows().length === 0 && serverPort) {
      createWindow(serverPort);
    }
  });
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
