import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import type { TemplateConfig } from "@/app/api/config/route";
import { LEDGER_PATH, readJson } from "@/lib/paths";

// ── Receipt ledger ────────────────────────────────────────────────────────────
// Stored in the app config dir (not the shared folder) so deleting/moving the
// output folder can't lose issuance history. PDPA: keyed by Student ID (an
// opaque generated code) — no names or phone numbers in the ledger.

export interface LedgerEntry {
  studentId: string;     // permanent identity, e.g. "S007"
  /** Display-only; kept for older entries written before Student IDs existed.
   *  Never used to match anything — serials renumber when rows are deleted. */
  serialNo?: number;
  term: string;          // sheet name, e.g. "AY 26 T3"
  receiptNo: string;     // deterministic, e.g. R-AY26T4-S007
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

export function ledgerKey(sheetName: string, studentId: string): string {
  return `${termSlug(sheetName)}-${studentId.toUpperCase()}`;
}

export function receiptNo(sheetName: string, studentId: string): string {
  return `R-${termSlug(sheetName)}-${studentId.toUpperCase()}`;
}

export function readLedger(): Ledger {
  try {
    return readJson<Ledger>(LEDGER_PATH);
  } catch {
    return {};
  }
}

export function writeLedger(ledger: Ledger): void {
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2), "utf8");
}

// ── Output folder ─────────────────────────────────────────────────────────────

/** Sanitise a term into a safe single folder segment. Keeps it human-readable
 *  ("AY 26 T3") but strips path separators, drive/colon, and dot-segments so a
 *  crafted sheet name can never escape the output folder (path traversal). */
export function safeTermFolder(term: string): string {
  const cleaned = (term ?? "")
    .replace(/[/\\:]+/g, " ")      // kill path separators + drive colons
    .replace(/\.\.+/g, "")          // kill dot-dot sequences
    .replace(/[<>:"|?*\x00-\x1f]/g, "") // illegal Windows filename chars
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "TERM";
}

/** Returns the absolute directory (created if needed), or null if not configured. */
export function ensureOutputDir(config: TemplateConfig, sub: string, term: string): string | null {
  const base = config.outputFolder?.trim();
  if (!base) return null;
  // sub is a hardcoded caller constant; term is sanitised to prevent traversal.
  const dir = path.join(base, sub, safeTermFolder(term));
  // Defence-in-depth: the resolved dir must stay inside base.
  const rel = path.relative(path.resolve(base), path.resolve(dir));
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Invalid output path");
  }
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
