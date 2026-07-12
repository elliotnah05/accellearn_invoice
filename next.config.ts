import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle (.next/standalone/server.js) that
  // Electron can spawn in production without the full node_modules tree.
  output: "standalone",
  // Keep these out of the bundler and trace them as real node_modules into the
  // standalone output. Both do dynamic requires / touch Node internals that can
  // break when bundled; exceljs in particular powers the Excel write-back.
  serverExternalPackages: ["exceljs", "xlsx"],
};

export default nextConfig;
