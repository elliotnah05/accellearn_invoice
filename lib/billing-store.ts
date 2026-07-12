import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import type { TemplateConfig } from "@/app/api/config/route";
import { LEDGER_PATH } from "@/lib/paths";

// ── Receipt ledger ────────────────────────────────────────────────────────────
// Stored in the app config dir (not the shared folder) so deleting/moving the
// output folder can't lose issuance history. PDPA: keyed by serial number —
// no names or phone numbers in the ledger.

export interface LedgerEntry {
  serialNo: number;
  term: string;          // sheet name, e.g. "AY 26 T3"
  receiptNo: string;     // deterministic, e.g. R-AY26T3-007
  amount: number;
  issuedAt: string;      // ISO — first generated
  reissuedAt: string[];  // ISO timestamps of explicit re-issues
  sentAt: string | null; // ISO — admin marked as sent to parent
  file: string;          // path of the written PDF
}

export type Ledger = Record<string, LedgerEntry>;

export function termSlug(sheetName: string): string {
  return sheetName.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "TERM";
}

export function ledgerKey(sheetName: string, serialNo: number): string {
  return `${termSlug(sheetName)}-${serialNo}`;
}

export function receiptNo(sheetName: string, serialNo: number): string {
  return `R-${termSlug(sheetName)}-${String(serialNo).padStart(3, "0")}`;
}

export function readLedger(): Ledger {
  try {
    return JSON.parse(readFileSync(LEDGER_PATH, "utf8")) as Ledger;
  } catch {
    return {};
  }
}

export function writeLedger(ledger: Ledger): void {
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2), "utf8");
}

// ── Output folder ─────────────────────────────────────────────────────────────

/** Returns the absolute directory (created if needed), or null if not configured. */
export function ensureOutputDir(config: TemplateConfig, sub: string, term: string): string | null {
  const base = config.outputFolder?.trim();
  if (!base) return null;
  const dir = path.join(base, sub, term);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function safeFileName(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function outputFolderExists(config: TemplateConfig): boolean {
  const base = config.outputFolder?.trim();
  return !!base && existsSync(base);
}
