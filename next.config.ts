import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the tracing root to this app dir. Without it, configuring
  // outputFileTracing* makes Next infer a workspace root higher up, which
  // nests the standalone output (standalone/Documents/…/app/server.js) and
  // breaks electron/main.js's fixed standalone/server.js path.
  outputFileTracingRoot: path.join(__dirname),
  // Produce a self-contained server bundle (.next/standalone/server.js) that
  // Electron can spawn in production without the full node_modules tree.
  output: "standalone",
  // Keep these out of the bundler and trace them as real node_modules into the
  // standalone output. Both do dynamic requires / touch Node internals that can
  // break when bundled; exceljs in particular powers the Excel write-back.
  serverExternalPackages: ["exceljs", "xlsx"],
  // Desktop app on localhost serving a handful of local PNGs — on-the-fly image
  // optimization buys nothing and would require sharp (a native binary) inside
  // the standalone bundle, which breaks the universal-Mac merge in CI.
  images: { unoptimized: true },
  // With optimization off, sharp must also stay out of the traced bundle.
  outputFileTracingExcludes: {
    "*": ["**/node_modules/sharp/**", "**/node_modules/@img/**"],
  },
};

export default nextConfig;
