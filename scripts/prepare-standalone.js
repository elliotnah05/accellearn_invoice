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

// Defensive: if Next ever traces the electron-builder output into the bundle,
// strip it so it can't recursively balloon the packaged app (dist→standalone→dist).
const stray = path.join(appRoot, ".next", "standalone", "dist");
if (fs.existsSync(stray)) {
  fs.rmSync(stray, { recursive: true, force: true });
  console.warn("prepare-standalone: removed stray .next/standalone/dist");
}

// Next's standalone tracer sometimes omits compiled next-server *runtime* files
// (seen: app-route-turbo.runtime.prod.js missing → every API route 500s in the
// packaged app, which has no full node_modules to fall back to). Copy every
// production runtime file from the full next install into the bundle so all
// route types resolve.
const nsRel = path.join("node_modules", "next", "dist", "compiled", "next-server");
const nsSrc = path.join(appRoot, nsRel);
const nsDest = path.join(appRoot, ".next", "standalone", nsRel);
if (fs.existsSync(nsSrc)) {
  fs.mkdirSync(nsDest, { recursive: true });
  let copied = 0;
  for (const f of fs.readdirSync(nsSrc)) {
    if (!f.endsWith(".runtime.prod.js")) continue; // prod runtimes only, no maps/dev
    const to = path.join(nsDest, f);
    if (!fs.existsSync(to)) { fs.copyFileSync(path.join(nsSrc, f), to); copied++; }
  }
  console.log(`prepare-standalone: ensured ${copied} next-server runtime file(s)`);
}
