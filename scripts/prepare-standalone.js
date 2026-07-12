// Post-build step for the Electron/standalone bundle.
//
// `next build` with output:"standalone" emits .next/standalone/server.js and a
// traced node_modules, and (on Next 16) copies public/ + the app/config seeds,
// but it does NOT copy the client assets in .next/static. The standalone server
// serves those from .next/standalone/.next/static, so we copy them in here.

const fs = require("fs");
const path = require("path");

const appRoot = path.join(__dirname, "..");
const src = path.join(appRoot, ".next", "static");
const dest = path.join(appRoot, ".next", "standalone", ".next", "static");

if (!fs.existsSync(src)) {
  console.error("prepare-standalone: .next/static not found — run `next build` first.");
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });

console.log(`prepare-standalone: copied .next/static -> ${path.relative(appRoot, dest)}`);
