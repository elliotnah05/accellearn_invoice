"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { subjectsText, type Student, type ParseResult } from "@/types/student";
import type { LedgerEntry } from "@/lib/billing-store";
import { isDesktop, openFolder } from "@/lib/desktop";

function fmtCurrency(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
}

/** Admin conventions vary — treat any non-empty value that isn't "no"/"n" as paid. */
function isPaid(s: Student): boolean {
  const v = s.paid.trim().toLowerCase();
  return v !== "" && v !== "no" && v !== "n" && v !== "false" && v !== "0";
}

type RowStatus = "unpaid" | "ready" | "generated" | "sent";

export default function ReceiptsPage() {
  const [students, setStudents]   = useState<Student[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [entries, setEntries]     = useState<Record<number, LedgerEntry>>({});
  const [folderOk, setFolderOk]   = useState<boolean | null>(null);
  const [outputFolder, setOutputFolder] = useState<string>("");
  const [busy, setBusy]           = useState<Set<number>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [banner, setBanner]       = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [confirmDup, setConfirmDup] = useState<{ student: Student; entry: LedgerEntry } | null>(null);

  useEffect(() => {
    loadLive();
  }, []);

  /** Preferred path: read the master sheet live (no re-importing). Falls back
   *  to the last imported data in this browser session. */
  async function loadLive() {
    try {
      const res = await fetch("/api/students");
      if (res.ok) {
        const data = (await res.json()) as ParseResult;
        setStudents(data.students);
        setSheetName(data.sheetName);
        sessionStorage.setItem("accel_students", JSON.stringify(data.students));
        sessionStorage.setItem("accel_sheet", data.sheetName);
        refreshLedger(data.sheetName);
        return;
      }
    } catch { /* fall through to session data */ }
    try {
      const raw   = sessionStorage.getItem("accel_students");
      const sheet = sessionStorage.getItem("accel_sheet");
      if (raw)   setStudents(JSON.parse(raw));
      if (sheet) { setSheetName(sheet); refreshLedger(sheet); }
    } catch { /* sessionStorage unavailable */ }
  }

  async function refreshLedger(term: string) {
    try {
      const res = await fetch(`/api/receipts?term=${encodeURIComponent(term)}`);
      const body = await res.json();
      setFolderOk(!!body.folderConfigured);
      if (body.outputFolder) setOutputFolder(body.outputFolder);
      const map: Record<number, LedgerEntry> = {};
      for (const e of body.entries as LedgerEntry[]) map[e.serialNo] = e;
      setEntries(map);
    } catch { /* server down — leave as-is */ }
  }

  function rowStatus(s: Student): RowStatus {
    const e = entries[s.serialNo];
    if (e?.sentAt) return "sent";
    if (e) return "generated";
    return isPaid(s) ? "ready" : "unpaid";
  }

  function setRowBusy(serialNo: number, on: boolean) {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(serialNo); else next.delete(serialNo);
      return next;
    });
  }

  async function generate(student: Student, force = false): Promise<boolean> {
    setRowBusy(student.serialNo, true);
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
      setEntries((prev) => ({ ...prev, [student.serialNo]: body.entry }));
      setBanner(body.warning
        ? { kind: "warn", text: `Receipt ${body.entry.receiptNo} created, but: ${body.warning}` }
        : { kind: "ok", text: `Receipt ${body.entry.receiptNo} saved to the shared folder` });
      return true;
    } catch {
      setBanner({ kind: "warn", text: "Network error — is the dev server running?" });
      return false;
    } finally {
      setRowBusy(student.serialNo, false);
    }
  }

  async function markSent(student: Student) {
    setRowBusy(student.serialNo, true);
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markSent", serialNo: student.serialNo, term: sheetName }),
      });
      const body = await res.json();
      if (!res.ok) {
        setBanner({ kind: "warn", text: body.error ?? "Could not mark as sent" });
        return;
      }
      setEntries((prev) => ({ ...prev, [student.serialNo]: body.entry }));
      setBanner(body.warning
        ? { kind: "warn", text: `Marked as sent, but: ${body.warning}` }
        : { kind: "ok", text: `Marked as sent — Excel updated` });
    } catch {
      setBanner({ kind: "warn", text: "Network error — is the dev server running?" });
    } finally {
      setRowBusy(student.serialNo, false);
    }
  }

  async function generateAllReady() {
    setBulkRunning(true);
    let done = 0;
    for (const s of students) {
      if (rowStatus(s) !== "ready") continue;   // never touches already-generated rows
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
            onClick={loadLive}
            className="text-purple-100 hover:text-white text-sm border border-purple-300 rounded-lg px-3 py-1 transition-colors"
            title="Re-read the master spreadsheet for the latest payment statuses"
          >
            ⟳ Refresh
          </button>
          <span className="text-purple-200 text-sm">{sheetName}</span>
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
                  className="text-xs px-2 py-1 rounded border border-green-300 text-green-700 hover:bg-green-100 font-medium whitespace-nowrap"
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
              const e = entries[s.serialNo];
              const isBusy = busy.has(s.serialNo);
              return (
                <div key={s.serialNo} className="py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{s.studentName}</p>
                    <p className="text-xs text-gray-400">
                      {s.parentName} · {subjectsText(s)} ({s.level})
                      {s.dateOfReceipt && <span> · paid {s.dateOfReceipt}</span>}
                      {e && <span className="text-gray-500 font-mono"> · {e.receiptNo}</span>}
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
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold">Generated {fmtDate(e?.issuedAt)}</span>
                    )}
                    {st === "sent" && (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold">✓ Sent {fmtDate(e?.sentAt)}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="w-56 flex justify-end gap-2 shrink-0">
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

      {/* ── Duplicate confirmation modal ── */}
      {confirmDup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="font-bold text-gray-800 mb-2">⚠ Receipt already exists</h3>
            <p className="text-sm text-gray-600 mb-1">
              A receipt for <strong>{confirmDup.student.studentName}</strong> was already generated on{" "}
              <strong>{fmtDate(confirmDup.entry.issuedAt)}</strong>{" "}
              (<span className="font-mono text-xs">{confirmDup.entry.receiptNo}</span>
              {confirmDup.entry.sentAt && <> — and marked <strong>sent on {fmtDate(confirmDup.entry.sentAt)}</strong></>}).
            </p>
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
