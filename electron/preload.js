// Minimal, locked-down bridge exposed to the web app.
// Only whitelisted actions are reachable from the renderer — no general Node access.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("accel", {
  // Open a local folder (e.g. the export output folder) in the OS file manager.
  openPath: (p) => ipcRenderer.invoke("accel:open-path", p),
  // Lets the web UI know it's running inside the desktop app.
  isDesktop: true,
});
