// Launches Electron for local runs.
//
// Some shells export ELECTRON_RUN_AS_NODE=1, which makes the `electron` binary
// behave like plain Node (no BrowserWindow/app APIs). We spawn Electron with a
// cleaned environment so `npm run electron` works regardless of the outer shell.
// The child Next server started by electron/main.js sets ELECTRON_RUN_AS_NODE=1
// itself, so clearing it here is safe.

const { spawn } = require("child_process");
const electronPath = require("electron"); // resolves to the binary path

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ["."], { stdio: "inherit", env });
child.on("close", (code) => process.exit(code ?? 0));
