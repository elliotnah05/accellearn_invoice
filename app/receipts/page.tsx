"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { subjectsText, identityKey, type Student, type ParseResult } from "@/types/student";
import type { LedgerEntry } from "@/lib/billing-store";
import { receiptState } from "@/lib/receipt-status";
import { isDesktop, openFolder } from "@/lib/desktop";

function fmtCurrency(n: number) {
  return `$${n.toFixed(2)}`;
}

/** dd/mm/yy — matches the date format sheet-writeback.ts stamps into the cells. */
function dmyToday(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
}

/** Admin conventions vary — treat any non-empty value that isn't "no"/"n" as paid. */
function isPaid(s: Student): boolean {
  const v = s.paid.trim().toLowerCase();
  return v !== "" && v !== "no" && v !== "n" && v !== "false" && v !== "0";
}

/** Stable per-child key for React keys and lookups. Falls back to the serial
 *  for the brief window before a new child has been assigned a Student ID. */
function sKey(s: Student): string {
  return s.studentId || `#${s.serialNo}`;
}

type RowStatus = "unpaid" | "ready" | "generated" | "sent";

export default function ReceiptsPage() {
  const [students, setStudents]   = useState<Student[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [folderOk, setFolderOk]   = useState<boolean | null>(null);
  const [outputFolder, setOutputFolder] = useState<string>("");
  const [busy, setBusy]           = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [banner, setBanner]       = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [sheetIssues, setSheetIssues] = useState<string[]>([]);
  const [confirmDup, setConfirmDup] = useState<{ student: Student; entry: LedgerEntry } | null>(null);
  const [preview, setPreview]     = useState<{ url: string; name: string } | null>(null);
  const [previewing, setPreviewing] = useState<Set<string>>(new Set());
  const previewCache = useRef<Record<string, string>>({});

  useEffect(() => {
    loadLive();
  }, []);

  /** Preferred path: read the master sheet live (no re-importing). Falls back
   *  to the last imported data in this browser session. Pass a term tab name to
   *  load a specific term; omit it for the active term (first tab after Master). */
  async function loadLive(sheet?: string) {
    try {
      const url = sheet ? `/api/students?sheet=${encodeURIComponent(sheet)}` : "/api/students";
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as ParseResult;
        setStudents(data.students);
        setSheetName(data.sheetName);
        setSheetNames(data.sheetNames ?? []);
        setSheetIssues(data.errors ?? []);
        sessionStorage.setItem("accel_students", JSON.stringify(data.students));
        sessionStorage.setItem("accel_sheet", data.sheetName);
        refreshFolderStatus(data.sheetName);
        return;
      }
    } catch { /* fall through to session data */ }
    try {
      const raw   = sessionStorage.getItem("accel_students");
      const sheet = sessionStorage.getItem("accel_sheet");
      if (raw)   setStudents(JSON.parse(raw));
      if (sheet) { setSheetName(sheet); refreshFolderStatus(sheet); }
    } catch { /* sessionStorage unavailable */ }
  }

  async function refreshFolderStatus(term: string) {
    try {
      const res = await fetch(`/api/receipts?term=${encodeURIComponent(term)}`);
      const body = await res.json();
      setFolderOk(!!body.folderConfigured);
      if (body.outputFolder) setOutputFolder(body.outputFolder);
    } catch { /* server down — leave as-is */ }
  }

  /** The live spreadsheet is the single source of truth for receipt status — no
   *  ledger here, so clearing a Receipt Issued/Sent cell in Excel and refreshing
   *  undoes the status in the app, and marking it by hand in Excel shows up. */
  function stateFor(s: Student) {
    return receiptState(s);
  }

  /** Reflect a just-completed write-back in the in-memory sheet data, so the row
   *  updates instantly. The next live reload re-reads the real cells, keeping the
   *  spreadsheet authoritative. Mirrors what sheet-writeback.ts writes. */
  function patchStudent(key: string, patch: Partial<Student>) {
    setStudents((prev) => prev.map((s) => (sKey(s) === key ? { ...s, ...patch } : s)));
  }

  function rowStatus(s: Student): RowStatus {
    const st = stateFor(s);
    if (st?.sent) return "sent";
    if (st) return "generated";
    return isPaid(s) ? "ready" : "unpaid";
  }

  /** IDs appearing on more than one child. Generating for either would give
   *  both children the SAME receipt number, so their action buttons lock
   *  until the duplicate is fixed on Master. */
  const dupIds = (() => {
    const count = new Map<string, number>();
    for (const s of students) if (s.studentId) count.set(s.studentId, (count.get(s.studentId) ?? 0) + 1);
    return new Set([...count.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  })();

  /** Children indistinguishable on the sheet: the same name AND parent. Almost
   *  always one child typed twice — generating for both would double up, so
   *  their action buttons lock until the sheet says which row is real. */
  const dupIdents = (() => {
    const count = new Map<string, number>();
    for (const s of students) {
      const k = identityKey(s.studentName, s.parentName);
      count.set(k, (count.get(k) ?? 0) + 1);
    }
    return new Set([...count.entries()].filter(([, n]) => n > 1).map(([k]) => k));
  })();

  function blockReason(s: Student): { label: string; hint: string } | null {
    if (s.studentId && dupIds.has(s.studentId)) {
      return { label: "⚠ Duplicate ID", hint: `Student ID ${s.studentId} is used by more than one child — fix the Student ID column on Master, then Refresh` };
    }
    if (dupIdents.has(identityKey(s.studentName, s.parentName))) {
      return { label: "⚠ Same name & parent", hint: "Two rows have this exact name and parent. If it's one child typed twice, delete the extra Master row; if they're different children, make one name distinguishable. Then Refresh" };
    }
    return null;
  }

  function isBlocked(s: Student): boolean {
    return blockReason(s) !== null;
  }

  function setRowBusy(key: string, on: boolean) {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(key); else next.delete(key);
      return next;
    });
  }

  async function generate(student: Student, force = false): Promise<boolean> {
    setRowBusy(sKey(student), true);
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", student, term: sheetName, force }),
      });
      const body = await res.json();
      if (res.status === 409 && body.duplicate) {
        setConfirmDup({ student, entry: body.entry });
        return false;
      }
      if (!res.ok) {
        setBanner({ kind: "warn", text: body.error ?? "Receipt generation failed" });
        return false;
      }
      // Mirror the Receipt Issued write-back into the in-memory sheet so the row
      // flips to "generated" at once; the next reload re-syncs from the sheet.
      patchStudent(sKey(student), { receiptIssued: `${body.entry.receiptNo} · ${dmyToday()}` });
      setBanner(body.warning
        ? { kind: "warn", text: `Receipt ${body.entry.receiptNo} created, but: ${body.warning}` }
        : { kind: "ok", text: `Receipt ${body.entry.receiptNo} saved to the shared folder` });
      return true;
    } catch {
      setBanner({ kind: "warn", text: "Network error — is the dev server running?" });
      return false;
    } finally {
      setRowBusy(sKey(student), false);
    }
  }

  async function markSent(student: Student) {
    setRowBusy(sKey(student), true);
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markSent", studentId: student.studentId, term: sheetName }),
      });
      const body = await res.json();
      if (!res.ok) {
        setBanner({ kind: "warn", text: body.error ?? "Could not mark as sent" });
        return;
      }
      // Mirror the Receipt Sent write-back so the row flips to "sent" at once.
      patchStudent(sKey(student), { receiptSent: `Sent ${dmyToday()}` });
      setBanner(body.warning
        ? { kind: "warn", text: `Marked as sent, but: ${body.warning}` }
        : { kind: "ok", text: `Marked as sent — Excel updated` });
    } catch {
      setBanner({ kind: "warn", text: "Network error — is the dev server running?" });
    } finally {
      setRowBusy(sKey(student), false);
    }
  }

  /** Render-only preview — never assigns a receipt number for real, never
   *  writes a file or touches the sheet. Cached per student for the session. */
  async function previewReceipt(student: Student) {
    if (previewCache.current[sKey(student)]) {
      setPreview({ url: previewCache.current[sKey(student)], name: student.studentName });
      return;
    }
    setPreviewing((prev) => new Set(prev).add(sKey(student)));
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", student, term: sheetName }),
      });
      if (!res.ok) {
        setBanner({ kind: "warn", text: "Could not build receipt preview" });
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      previewCache.current[sKey(student)] = url;
      setPreview({ url, name: student.studentName });
    } catch {
      setBanner({ kind: "warn", text: "Network error — is the dev server running?" });
    } finally {
      setPreviewing((prev) => {
        const next = new Set(prev);
        next.delete(sKey(student));
        return next;
      });
    }
  }

  function downloadFromPreview() {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview.url;
    a.download = `Receipt_${preview.name.replace(/\s+/g, "_")}.pdf`;
    a.click();
  }

  async function generateAllReady() {
    setBulkRunning(true);
    let done = 0;
    for (const s of students) {
      if (rowStatus(s) !== "ready") continue;   // never touches already-generated rows
      if (isBlocked(s)) continue;               // duplicate ID or indistinguishable twin — fix the sheet first
      if (await generate(s)) done++;
    }
    setBulkRunning(false);
    if (done > 0) setBanner({ kind: "ok", text: `${done} receipt(s) generated and saved to the shared folder` });
  }

  const counts = {
    unpaid:    students.filter((s) => rowStatus(s) === "unpaid").length,
    ready:     students.filter((s) => rowStatus(s) === "ready").length,
    generated: students.filter((s) => rowStatus(s) === "generated").length,
    sent:      students.filter((s) => rowStatus(s) === "sent").length,
  };

  if (students.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">
            No student data found. Set the master spreadsheet path in Invoice Template → Folders (recommended),
            or import a sheet manually.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/settings" className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: "#AB33DA" }}>
              Open Settings
            </Link>
            <Link href="/import" className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "#AB33DA", color: "#AB33DA" }}>
              Go to Import
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header style={{ backgroundColor: "#AB33DA" }} className="px-8 py-4 flex items-center gap-3 shadow">
        <Link href="/" className="text-white opacity-70 hover:opacity-100 text-sm">← Back</Link>
        <div className="w-px h-5 bg-purple-300 mx-1" />
        <h1 className="text-white font-bold">Phase 4 — Generate Receipts</h1>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => loadLive(sheetName || undefined)}
            className="text-purple-100 hover:text-white text-sm border border-purple-300 rounded-lg px-3 py-1 transition-colors"
            title="Re-read the master spreadsheet for the latest payment statuses"
          >
            ⟳ Refresh
          </button>
          {sheetNames.length > 0 ? (
            <select
              value={sheetName}
              onChange={(e) => loadLive(e.target.value)}
              title="Choose which term's receipts to work on. The list updates automatically as you add tabs to the workbook."
              className="text-sm bg-white/15 text-white border border-purple-300 rounded-lg px-2 py-1 focus:outline-none focus:border-white [&>option]:text-gray-800"
            >
              {sheetNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          ) : (
            <span className="text-purple-200 text-sm">{sheetName}</span>
          )}
        </div>
      </header>

      <div className="flex-1 px-8 py-8 max-w-4xl mx-auto w-full flex flex-col gap-5">

        {/* Folder not configured */}
        {folderOk === false && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-800">
            ⚠ The shared output folder isn&apos;t set (or doesn&apos;t exist).{" "}
            <Link href="/settings" className="underline font-semibold">Set it in Invoice Template → Folders</Link> before generating receipts.
          </div>
        )}

        {/* Sheet issues — orphan rows, missing/duplicate Student IDs, shifted
            status stamps. Generating against a misaligned sheet is what caused
            the duplicate-invoice mess, so these get a persistent banner. */}
        {sheetIssues.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">⚠ Spreadsheet needs attention</p>
            <ul className="text-xs text-amber-700 list-disc ml-4 space-y-0.5">
              {sheetIssues.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {/* Status banner */}
        {banner && (
          <div className={`rounded-xl border p-4 text-sm flex items-start justify-between gap-4 ${
            banner.kind === "ok" ? "bg-green-50 border-green-200 text-green-700" : "bg-amber-50 border-amber-300 text-amber-800"
          }`}>
            <span>{banner.text}</span>
            <span className="flex items-center gap-3 flex-shrink-0">
              {banner.kind === "ok" && outputFolder && isDesktop() && (
                <button
                  onClick={() => openFolder(outputFolder)}
                  className="px-4 py-2 text-sm rounded-lg border border-green-300 text-green-700 hover:bg-green-100 font-medium whitespace-nowrap flex-shrink-0"
                >
                  📂 Open folder
                </button>
              )}
              <button onClick={() => setBanner(null)} className="opacity-60 hover:opacity-100">✕</button>
            </span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Awaiting payment", value: counts.unpaid,    cls: "text-gray-500"  },
            { label: "Ready for receipt", value: counts.ready,    cls: "text-purple-600" },
            { label: "Generated",         value: counts.generated, cls: "text-blue-600"  },
            { label: "Sent to parent",    value: counts.sent,      cls: "text-green-600" },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{c.label}</p>
              <p className={`font-bold text-xl mt-0.5 ${c.cls}`}>{c.value}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400">
          Mark payments in the Excel (Paid + Date of Receipt), re-import, then generate here. Receipt numbers are fixed per
          student — re-generating never creates a second receipt, and the app warns before any re-issue.
        </p>

        {/* Rows */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex flex-col divide-y divide-gray-100">
            {students.map((s) => {
              const st = rowStatus(s);
              const rs = stateFor(s);
              const isBusy = busy.has(sKey(s));
              return (
                <div key={sKey(s)} className="py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{s.studentName}</p>
                    <p className="text-xs text-gray-400">
                      {s.studentId && <span className="font-mono text-gray-500">{s.studentId} · </span>}
                      {s.parentName} · {subjectsText(s)} ({s.level})
                      {s.dateOfReceipt && <span> · paid {s.dateOfReceipt}</span>}
                      {rs?.receiptNo && <span className="text-gray-500 font-mono"> · {rs.receiptNo}</span>}
                    </p>
                  </div>
                  <p className="font-bold text-sm shrink-0" style={{ color: "#AB33DA" }}>{fmtCurrency(s.totalFee)}</p>

                  {/* Status chip */}
                  <div className="w-40 text-center shrink-0">
                    {st === "unpaid" && (
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">Awaiting payment</span>
                    )}
                    {st === "ready" && (
                      <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 font-semibold">Ready for receipt</span>
                    )}
                    {st === "generated" && (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold">Generated {rs?.issued}</span>
                    )}
                    {st === "sent" && (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold">✓ Sent {rs?.sent}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="w-72 flex justify-end gap-2 shrink-0">
                    <button
                      onClick={() => previewReceipt(s)}
                      disabled={previewing.has(sKey(s))}
                      className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-40"
                      style={{ borderColor: "#AB33DA", color: "#AB33DA" }}
                      title="See exactly what this receipt will look like — nothing is saved or issued"
                    >
                      {previewing.has(sKey(s)) ? "Loading…" : "Preview"}
                    </button>
                    {isBlocked(s) ? (
                      <span
                        className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-600 font-semibold"
                        title={blockReason(s)!.hint}
                      >
                        {blockReason(s)!.label}
                      </span>
                    ) : (
                      <>
                        {st === "ready" && (
                          <button
                            onClick={() => generate(s)}
                            disabled={isBusy || bulkRunning || folderOk === false}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
                            style={{ backgroundColor: "#AB33DA" }}
                          >
                            {isBusy ? "Generating…" : "Generate Receipt"}
                          </button>
                        )}
                        {st === "generated" && (
                          <button
                            onClick={() => markSent(s)}
                            disabled={isBusy}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-40"
                          >
                            Mark as Sent
                          </button>
                        )}
                        {(st === "generated" || st === "sent") && (
                          <button
                            onClick={() => generate(s)}
                            disabled={isBusy || bulkRunning}
                            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40"
                            title="Re-create this receipt (asks for confirmation)"
                          >
                            Re-generate
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bulk */}
        <button
          onClick={generateAllReady}
          disabled={counts.ready === 0 || bulkRunning || folderOk === false}
          className="w-full py-3 rounded-xl text-white font-bold shadow disabled:opacity-40"
          style={{ backgroundColor: "#AB33DA" }}
        >
          {bulkRunning ? "Generating…" : `🧾 Generate All Ready (${counts.ready})`}
        </button>

        <div className="flex items-center justify-center gap-6 pb-6">
          <Link href="/status" className="text-sm text-gray-400 hover:text-gray-600">View status overview →</Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">↩ Return to Menu</Link>
        </div>
      </div>

      {/* ── Receipt preview modal ── */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setPreview(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            style={{ width: "min(820px, 95vw)", height: "90vh" }}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200"
              style={{ backgroundColor: "#AB33DA" }}>
              <p className="text-white font-semibold text-sm">Receipt preview — {preview.name}</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={downloadFromPreview}
                  className="px-3 py-1.5 text-xs rounded-lg bg-white font-semibold transition-opacity hover:opacity-90"
                  style={{ color: "#AB33DA" }}
                >
                  Download PDF
                </button>
                <button
                  onClick={() => setPreview(null)}
                  className="text-white opacity-70 hover:opacity-100 text-xl leading-none px-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* PDF iframe */}
            <iframe
              src={preview.url}
              className="flex-1 w-full"
              title={`Receipt preview for ${preview.name}`}
            />
          </div>
        </div>
      )}

      {/* ── Duplicate confirmation modal ── */}
      {confirmDup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="font-bold text-gray-800 mb-2">⚠ Receipt already exists</h3>
            {(() => {
              // Dates may come from the spreadsheet (another admin issued it) or
              // from this machine's ledger — receiptState covers both.
              const rs = receiptState(confirmDup.student, confirmDup.entry);
              return (
                <p className="text-sm text-gray-600 mb-1">
                  A receipt for <strong>{confirmDup.student.studentName}</strong> was already generated
                  {rs?.issued ? <> on <strong>{rs.issued}</strong></> : null}{" "}
                  (<span className="font-mono text-xs">{rs?.receiptNo}</span>
                  {rs?.sent && <> — and marked <strong>sent on {rs.sent}</strong></>}).
                </p>
              );
            })()}
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to create it again? It keeps the <strong>same receipt number</strong> and replaces the
              old file, so no duplicate receipt will exist.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDup(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => { const d = confirmDup; setConfirmDup(null); generate(d.student, true); }}
                className="px-4 py-2 text-sm rounded-lg text-white font-semibold"
                style={{ backgroundColor: "#AB33DA" }}
              >
                Yes, re-create it
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
