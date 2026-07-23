"use client";

import { useEffect, useState, useRef, Fragment } from "react";
import Link from "next/link";
import { subjectsText, totalLessons, type Student } from "@/types/student";
import { isDesktop, openFolder } from "@/lib/desktop";

type ApprovalStatus = "pending" | "approved" | "flagged";

interface ReviewRow {
  student: Student;
  status: ApprovalStatus;
  flagNote: string;
  previewUrl: string | null;
  previewLoading: boolean;
}

function fmtCurrency(n: number) {
  return `$${n.toFixed(2)}`;
}

/** A student is part of this term's billing run only if there's something to
 *  charge. No lessons and a $0 total means "not enrolled this term" — e.g. a
 *  student added to Master ahead of a future term, with Lessons set to 0 on
 *  this term's tab. Those are kept out of the run so they don't clutter it or
 *  produce a $0 invoice. */
function isBilledThisTerm(s: Student): boolean {
  return s.totalFee > 0 || totalLessons(s) > 0;
}

const STATUS_CFG = {
  pending:  { label: "Pending",  bg: "bg-gray-100",    text: "text-gray-500",  dot: "bg-gray-400"   },
  approved: { label: "Approved", bg: "bg-green-50",    text: "text-green-700", dot: "bg-green-500"  },
  flagged:  { label: "Flagged",  bg: "bg-yellow-50",   text: "text-yellow-700",dot: "bg-yellow-400" },
};

export default function InvoicesPage() {
  const [rows, setRows]           = useState<ReviewRow[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [preview, setPreview]     = useState<{ url: string; name: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exportFolder, setExportFolder] = useState<string | null>(null);
  const urlCache = useRef<Record<number, string>>({});

  useEffect(() => {
    try {
      const raw   = sessionStorage.getItem("accel_students");
      const sheet = sessionStorage.getItem("accel_sheet");
      if (raw) {
        const students: Student[] = JSON.parse(raw);
        setRows(students.map((s) => ({
          student: s,
          status: "pending",
          flagNote: "",
          previewUrl: null,
          previewLoading: false,
        })));
      }
      if (sheet) setSheetName(sheet);
    } catch { /* sessionStorage unavailable */ }
  }, []);

  async function generatePreview(idx: number) {
    const row = rows[idx];
    const key = row.student.serialNo;

    // Use cached URL if available
    if (urlCache.current[key]) {
      setPreview({ url: urlCache.current[key], name: row.student.studentName });
      return;
    }

    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], previewLoading: true };
      return next;
    });

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row.student),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      urlCache.current[key] = url;
      setRows((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], previewUrl: url, previewLoading: false };
        return next;
      });
      setPreview({ url, name: row.student.studentName });
    } catch {
      setRows((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], previewLoading: false };
        return next;
      });
    }
  }

  function downloadFromPreview() {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview.url;
    a.download = `Invoice_${preview.name.replace(/\s+/g, "_")}.pdf`;
    a.click();
  }

  function setStatus(idx: number, status: ApprovalStatus) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], status, flagNote: status !== "flagged" ? "" : next[idx].flagNote };
      return next;
    });
  }

  function setFlagNote(idx: number, note: string) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], flagNote: note };
      return next;
    });
  }

  function approveAll() {
    setRows((prev) => prev.map((r) =>
      isBilledThisTerm(r.student) && r.status !== "flagged" ? { ...r, status: "approved" } : r
    ));
  }

  async function exportToFolder() {
    const approved = rows.filter((r) => r.status === "approved" && isBilledThisTerm(r.student)).map((r) => r.student);
    if (approved.length === 0) return;
    setExporting(true);
    setExportMsg(null);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: approved, term: sheetName }),
      });
      const body = await res.json();
      if (!res.ok) {
        setExportMsg(`⚠ ${body.error ?? "Export failed"}`);
      } else {
        setExportMsg(
          `✓ ${body.written} invoice PDF(s) saved to the shared folder` +
          (body.failed?.length ? ` — ${body.failed.length} failed` : "")
        );
        setExportFolder(body.folder ?? null);
        // Carry data forward for the receipts phase
        sessionStorage.setItem("accel_approved", JSON.stringify(approved));
        sessionStorage.setItem("accel_sheet", sheetName);
      }
    } catch {
      setExportMsg("⚠ Network error — is the dev server running?");
    } finally {
      setExporting(false);
    }
  }

  // Split out students not enrolled this term ($0, no lessons). Everything that
  // drives the run — counts, totals, approve-all, export — looks only at the
  // billed rows; the rest are shown in a muted "not billed this term" panel.
  const billed        = rows.filter((r) => isBilledThisTerm(r.student));
  const unbilled      = rows.filter((r) => !isBilledThisTerm(r.student));
  const approvedCount = billed.filter((r) => r.status === "approved").length;
  const flaggedCount  = billed.filter((r) => r.status === "flagged").length;
  const pendingCount  = billed.filter((r) => r.status === "pending").length;
  const grandTotal    = billed.reduce((s, r) => s + r.student.totalFee, 0);
  const approvedTotal = billed.filter((r) => r.status === "approved").reduce((s, r) => s + r.student.totalFee, 0);

  if (rows.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No student data found. Please import a sheet first.</p>
          <Link href="/import" className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: "#AB33DA" }}>
            ← Back to Import
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen flex flex-col pb-24">

        {/* Header */}
        <header style={{ backgroundColor: "#AB33DA" }} className="px-8 py-4 flex items-center gap-3 shadow">
          <Link href="/import" className="text-white opacity-70 hover:opacity-100 text-sm">← Back</Link>
          <div className="w-px h-5 bg-purple-300 mx-1" />
          <h1 className="text-white font-bold">Phase 3 — Review & Approve Invoices</h1>
          <span className="ml-auto text-purple-200 text-sm">{sheetName}</span>
        </header>

        <div className="flex-1 px-8 py-6 max-w-7xl mx-auto w-full flex flex-col gap-5">

          {/* Stats bar */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: "Total Students", value: billed.length,           sub: unbilled.length > 0 ? `${unbilled.length} not billed this term` : null, hex: null, cls: "text-gray-800" },
              { label: "Pending",        value: pendingCount,            sub: null,                       hex: null,      cls: "text-gray-500"    },
              { label: "Approved",       value: approvedCount,           sub: fmtCurrency(approvedTotal), hex: null,      cls: "text-green-600"   },
              { label: "Flagged",        value: flaggedCount,            sub: "needs attention",           hex: null,      cls: "text-yellow-600"  },
              { label: "Total Invoiced", value: fmtCurrency(grandTotal), sub: null,                       hex: "#AB33DA", cls: ""                 },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</p>
                <p
                  className={`font-bold text-xl mt-0.5 ${s.cls}`}
                  style={s.hex ? { color: s.hex } : undefined}
                >
                  {s.value}
                </p>
                {s.sub && <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>}
              </div>
            ))}
          </div>

          {/* Hint */}
          <p className="text-xs text-gray-400">
            Preview each invoice before approving. Flag any that need correction — flagged invoices will not be sent.
          </p>

          {/* Review table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "#AB33DA" }} className="text-white text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-semibold">#</th>
                  <th className="px-4 py-3 text-left font-semibold">Student</th>
                  <th className="px-4 py-3 text-left font-semibold">Parent</th>
                  <th className="px-4 py-3 text-center font-semibold">Level</th>
                  <th className="px-4 py-3 text-center font-semibold">Lessons</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 text-center font-semibold">Invoice</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  // Not-enrolled-this-term students are shown in the panel below,
                  // not in the billing table. `i` stays the real index so the
                  // action buttons keep updating the right row.
                  if (!isBilledThisTerm(row.student)) return null;
                  const cfg = STATUS_CFG[row.status];
                  return (
                    <Fragment key={row.student.serialNo}>
                      <tr
                        className={`border-t border-gray-100 transition-colors ${
                          row.status === "approved" ? "bg-green-50/40"
                          : row.status === "flagged" ? "bg-yellow-50/40"
                          : i % 2 === 1 ? "bg-gray-50"
                          : "bg-white"
                        } hover:bg-purple-50/30`}
                      >
                        <td className="px-4 py-3 text-gray-400 text-xs">{row.student.serialNo}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{row.student.studentName}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.student.parentName}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "#EDE9F7", color: "#7B2FBE" }}>
                            {row.student.level}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {totalLessons(row.student)}
                          {row.student.subjects.length > 1 && (
                            <span className="block text-xs text-gray-400">{subjectsText(row.student)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold" style={{ color: "#AB33DA" }}>
                          {fmtCurrency(row.student.totalFee)}
                        </td>

                        {/* Preview button */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => generatePreview(i)}
                            disabled={row.previewLoading}
                            className="px-3 py-1 text-xs rounded-lg border font-medium transition-colors disabled:opacity-50"
                            style={{ borderColor: "#AB33DA", color: "#AB33DA" }}
                          >
                            {row.previewLoading ? "Loading…" : row.previewUrl ? "Preview again" : "Preview PDF"}
                          </button>
                        </td>

                        {/* Status badge */}
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </td>

                        {/* Action buttons */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {row.status !== "approved" && (
                              <button
                                onClick={() => setStatus(i, "approved")}
                                className="px-2.5 py-1 text-xs rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition-colors"
                              >
                                ✓ Approve
                              </button>
                            )}
                            {row.status !== "flagged" && (
                              <button
                                onClick={() => setStatus(i, "flagged")}
                                className="px-2.5 py-1 text-xs rounded-lg bg-yellow-400 text-white font-medium hover:bg-yellow-500 transition-colors"
                              >
                                ⚠ Flag
                              </button>
                            )}
                            {row.status !== "pending" && (
                              <button
                                onClick={() => setStatus(i, "pending")}
                                className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Flag note row — inline expansion */}
                      {row.status === "flagged" && (
                        <tr className="bg-yellow-50/60 border-t border-yellow-100">
                          <td colSpan={9} className="px-4 pb-3 pt-1">
                            <div className="flex items-center gap-3 ml-6">
                              <span className="text-xs text-yellow-600 font-medium whitespace-nowrap">Flag reason:</span>
                              <input
                                type="text"
                                value={row.flagNote}
                                onChange={(e) => setFlagNote(i, e.target.value)}
                                placeholder="e.g. wrong adjustment, check lesson count…"
                                className="flex-1 text-xs border border-yellow-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-yellow-400"
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={5} className="px-4 py-3 text-right font-semibold text-gray-700">Grand Total</td>
                  <td className="px-4 py-3 text-right font-bold text-lg" style={{ color: "#AB33DA" }}>
                    {fmtCurrency(grandTotal)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Not billed this term — students on Master with no lessons set for
              this term (e.g. joining next term). Skipped from the run. */}
          {unbilled.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-600">
                Not billed this term
                <span className="ml-2 text-xs font-normal text-gray-400">({unbilled.length})</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5 mb-3">
                These students have no lessons set on <strong>{sheetName}</strong> (Lessons = 0), so there&apos;s nothing to
                invoice — they&apos;re skipped. To include one, set their Lessons on this term&apos;s tab.
              </p>
              <div className="flex flex-wrap gap-2">
                {unbilled.map((r) => (
                  <span
                    key={r.student.serialNo}
                    className="text-xs px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-500"
                  >
                    {r.student.studentName}
                    <span className="text-gray-300"> · </span>
                    {r.student.level}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── Sticky bottom action bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-8 py-4 flex items-center justify-between gap-6 z-10">
        <div className="flex items-center gap-6 text-sm text-gray-600 min-w-0">
          <span>
            <strong className="text-green-600">{approvedCount}</strong> approved ·{" "}
            <strong className="text-yellow-600">{flaggedCount}</strong> flagged ·{" "}
            <strong className="text-gray-400">{pendingCount}</strong> pending
          </span>
          {exportMsg ? (
            <span className="flex items-center gap-3">
              <span className={exportMsg.startsWith("✓") ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                {exportMsg}
              </span>
              {exportMsg.startsWith("✓") && exportFolder && isDesktop() && (
                <button
                  onClick={() => openFolder(exportFolder)}
                  className="px-4 py-2 text-sm rounded-lg border border-green-300 text-green-700 hover:bg-green-50 font-medium whitespace-nowrap flex-shrink-0"
                >
                  📂 Open folder
                </button>
              )}
            </span>
          ) : approvedCount > 0 && (
            <span className="text-green-600 font-medium">
              Ready to export: {fmtCurrency(approvedTotal)}
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <Link
            href="/"
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-500 font-medium transition-colors hover:bg-gray-50 flex items-center"
          >
            ← Return to Menu
          </Link>
          <button
            onClick={approveAll}
            disabled={pendingCount === 0}
            className="px-4 py-2 text-sm rounded-lg border font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: "#AB33DA", color: "#AB33DA" }}
          >
            Approve All Pending
          </button>
          <button
            onClick={exportToFolder}
            disabled={approvedCount === 0 || exporting}
            className="px-5 py-2 text-sm rounded-lg text-white font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: approvedCount > 0 ? "#AB33DA" : "#9CA3AF" }}
          >
            {exporting ? "Exporting…" : `Export to Folder (${approvedCount}) →`}
          </button>
        </div>
      </div>

      {/* ── PDF Preview Modal ── */}
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
              <p className="text-white font-semibold text-sm">Invoice — {preview.name}</p>
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
              title={`Invoice for ${preview.name}`}
            />
          </div>
        </div>
      )}
    </>
  );
}
