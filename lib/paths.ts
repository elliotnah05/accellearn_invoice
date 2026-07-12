import path from "path";
import { existsSync, mkdirSync, copyFileSync } from "fs";

// Centralised filesystem locations for the app's server-side data.
//
// In a packaged (Electron) build the app's own files live in a read-only
// resources dir, so the Electron main process sets ACCEL_DATA_DIR to a writable
// location (app userData). In plain `next dev` / `next start` the variable is
// unset and everything resolves to the in-repo folders exactly as before.

const BUNDLED_CONFIG_DIR = path.join(process.cwd(), "app", "config");

/** Writable dir for config + ledger (overridable in packaged builds). */
export const DATA_DIR = process.env.ACCEL_DATA_DIR || BUNDLED_CONFIG_DIR;

/** Editable invoice/company config (written by /api/config). */
export const CONFIG_PATH = path.join(DATA_DIR, "template.json");

/** Receipt issuance ledger (serials only — PDPA). */
export const LEDGER_PATH = path.join(DATA_DIR, "receipts-ledger.json");

/** Brand logo embedded in PDFs (read-only bundled asset). */
export const LOGO_PATH =
  process.env.ACCEL_LOGO_PATH || path.join(process.cwd(), "public", "logo.png");

/**
 * When ACCEL_DATA_DIR is set (packaged build), make sure the writable dir
 * exists and seed it once from the defaults shipped inside the bundle so the
 * app has a working template.json + ledger on first launch.
 */
export function ensureDataDir(): void {
  if (!process.env.ACCEL_DATA_DIR) return; // dev/`next start`: files already in repo
  mkdirSync(DATA_DIR, { recursive: true });
  for (const f of ["template.json", "receipts-ledger.json"]) {
    const dest = path.join(DATA_DIR, f);
    const src = path.join(BUNDLED_CONFIG_DIR, f);
    if (!existsSync(dest) && existsSync(src)) copyFileSync(src, dest);
  }
}

// Seed on first import (no-op in dev). Safe during `next build`: ACCEL_DATA_DIR
// is unset there, so this returns immediately.
ensureDataDir();
