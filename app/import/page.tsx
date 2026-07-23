"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { recalcLine, type Student, type SubjectLine, type ParseResult } from "@/types/student";

function maskPoc(poc: string): string {
  return poc.replace(/(\d{2})(\d{3})(\d{4})$/, "$1XXX$3");
}

function fmtCurrency(n: number) {
  return `$${n.toFixed(2)}`;
}

// Shared input style: invisible until focused, then shows border
const inputCls =
  "w-full bg-transparent border-b border-transparent focus:border-purple-400 focus:outline-none text-center py-0.5 focus:bg-white rounded transition-colors";

// Preview table columns — width/min drive the draggable colgroup below, so
// admins can pull columns wider/narrower to see long notes (like Excel).
const COLUMNS = [
  { key: "no",             width: 40,  min: 32  },
  { key: "student",        width: 140, min: 90  },
  { key: "parent",         width: 120, min: 80  },
  { key: "poc",            width: 110, min: 80  },
  { key: "level",          width: 90,  min: 60  },
  { key: "subject",        width: 110, min: 70  },
  { key: "rate",           width: 70,  min: 50  },
  { key: "duration",       width: 70,  min: 50  },
  { key: "lessons",        width: 70,  min: 50  },
  { key: "adjustment",     width: 90,  min: 60  },
  { key: "adjustmentNotes", width: 190, min: 120 },
  { key: "subtotal",       width: 90,  min: 60  },
  { key: "childTotal",     width: 100, min: 70  },
] as const;

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-0 right-0 h-full w-2 cursor-col-resize hover:bg-white/30 active:bg-white/50"
    />
  );
}

export default function ImportPage() {
  const [dragging, setDragging]         = useState(false);
  const [loading, setLoading]           = useState(false);
  const [sheetName, setSheetName]       = useState("");
  const [students, setStudents]         = useState<Student[]>([]);
  const [parseErrors, setParseErrors]   = useState<string[]>([]);
  const [hasData, setHasData]           = useState(false);
  const [editedCells, setEditedCells]   = useState<Set<string>>(new Set());
  const [error, setError]               = useState<string | null>(null);
  const [masterAvailable, setMasterAvailable] = useState(false);
  const [loadedFrom, setLoadedFrom]     = useState<"upload" | "master" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Draggable column widths (Excel-style column resize) ──
  const [colWidths, setColWidths] = useState<number[]>(() => COLUMNS.map((c) => c.width));
  const resizing = useRef<{ idx: number; startX: number; startWidth: number } | null>(null);

  const onResizeMove = useCallback((e: MouseEvent) => {
    const r = resizing.current;
    if (!r) return;
    const min = COLUMNS[r.idx].min;
    const next = Math.max(min, r.startWidth + (e.clientX - r.startX));
    setColWidths((prev) => {
      if (prev[r.idx] === next) return prev;
      const copy = [...prev];
      copy[r.idx] = next;
      return copy;
    });
  }, []);

  const onResizeUp = useCallback(() => {
    resizing.current = null;
    document.body.style.cursor = "";
    document.removeEventListener("mousemove", onResizeMove);
    document.removeEventListener("mouseup", onResizeUp);
  }, [onResizeMove]);

  const startResize = useCallback((idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = { idx, startX: e.clientX, startWidth: colWidths[idx] };
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", onResizeMove);
    document.addEventListener("mouseup", onResizeUp);
  }, [colWidths, onResizeMove, onResizeUp]);

  // Safety net: drop any listeners left attached if the component unmounts mid-drag.
  useEffect(() => () => {
    document.removeEventListener("mousemove", onResizeMove);
    document.removeEventListener("mouseup", onResizeUp);
  }, [onResizeMove, onResizeUp]);

  // Master sheet configured? (enables the one-click load button)
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg) => setMasterAvailable(!!cfg.spreadsheetPath?.trim()))
      .catch(() => {});
  }, []);

  function applyResult(data: ParseResult, from: "upload" | "master") {
    setSheetName(data.sheetName);
    setStudents(data.students);
    setParseErrors(data.errors);
    setHasData(true);
    setLoadedFrom(from);
    setEditedCells(new Set());
  }

  async function loadMaster() {
    setError(null);
    setLoading(true);
    try {
      const res  = await fetch("/api/students");
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not load the master sheet"); return; }
      applyResult(data as ParseResult, "master");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(file: File) {
    setError(null);
    setHasData(false);
    setStudents([]);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json() as ParseResult;
      if (!res.ok) { setError((data as unknown as { error: string }).error ?? "Upload failed"); return; }
      applyResult(data, "upload");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  function updateLine(childIdx: number, subjIdx: number, patch: Partial<SubjectLine>) {
    setStudents((prev) => {
      const next = [...prev];
      const child = { ...next[childIdx] };
      const subjects = [...child.subjects];
      subjects[subjIdx] = recalcLine({ ...subjects[subjIdx], ...patch });
      child.subjects = subjects;
      child.totalFee = subjects.reduce((t, l) => t + l.subtotal, 0);
      next[childIdx] = child;
      return next;
    });
    setEditedCells((prev) => new Set(prev).add(`${childIdx}-${subjIdx}`));
  }

  const grandTotal = students.reduce((s, r) => s + r.totalFee, 0);
  const subjectRows = students.reduce((n, s) => n + s.subjects.length, 0);

  // Flatten children into one table row per subject line
  const flat: { child: Student; childIdx: number; subjIdx: number; line: SubjectLine }[] = [];
  students.forEach((child, childIdx) =>
    child.subjects.forEach((line, subjIdx) => flat.push({ child, childIdx, subjIdx, line }))
  );

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header style={{ backgroundColor: "#AB33DA" }} className="px-8 py-4 flex items-center gap-3 shadow">
        <Link href="/" className="text-white opacity-70 hover:opacity-100 text-sm">← Back</Link>
        <div className="w-px h-5 bg-purple-300 mx-1" />
        <h1 className="text-white font-bold">Phase 1 — Import Sheet</h1>
        {hasData && loadedFrom === "master" && (
          <span className="ml-auto text-purple-200 text-xs">loaded live from master sheet</span>
        )}
      </header>

      <div className="flex-1 px-8 py-8 max-w-full mx-auto w-full">

        {/* Load zone */}
        {!hasData && (
          <div className="max-w-2xl mx-auto flex flex-col gap-4">
            {masterAvailable && (
              <button
                onClick={loadMaster}
                disabled={loading}
                className="w-full py-4 rounded-2xl text-white font-bold shadow transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "#AB33DA" }}
              >
                {loading ? "Loading…" : "📄 Load Master Sheet (from shared folder)"}
              </button>
            )}
            <div
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => inputRef.current?.click()}
              className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
                dragging ? "border-purple-500 bg-purple-50" : "border-gray-300 bg-white hover:border-purple-400 hover:bg-purple-50"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
              />
              <div className="text-5xl mb-4">📂</div>
              {loading ? (
                <p className="text-purple-600 font-medium animate-pulse">Parsing spreadsheet…</p>
              ) : (
                <>
                  <p className="text-gray-700 font-semibold text-lg mb-1">
                    {masterAvailable ? "…or drop a different Excel file here" : "Drop your Excel file here"}
                  </p>
                  <p className="text-gray-400 text-sm">or click to browse — .xlsx, .xls, .csv accepted</p>
                </>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm max-w-2xl mx-auto">
            {error}
          </div>
        )}

        {/* Results */}
        {hasData && (
          <div className="flex flex-col gap-5">

            {/* Summary bar */}
            <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Sheet</p>
                <p className="font-bold text-gray-800">{sheetName}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Students</p>
                <p className="font-bold text-gray-800 text-xl">
                  {students.length}
                  {subjectRows > students.length && (
                    <span className="text-sm text-gray-400 font-normal"> ({subjectRows} subject rows)</span>
                  )}
                </p>
              </div>
              {editedCells.size > 0 && (
                <div className="text-center">
                  <p className="text-xs text-yellow-600 uppercase tracking-wide font-semibold">Edited</p>
                  <p className="font-bold text-yellow-600">{editedCells.size} row{editedCells.size > 1 ? "s" : ""}</p>
                </div>
              )}
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Invoiced</p>
                <p className="font-bold text-xl" style={{ color: "#AB33DA" }}>{fmtCurrency(grandTotal)}</p>
              </div>
              <div className="flex gap-2">
                {masterAvailable && (
                  <button
                    onClick={loadMaster}
                    disabled={loading}
                    className="px-4 py-2 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 disabled:opacity-50"
                  >
                    ⟳ Reload master
                  </button>
                )}
                <button
                  onClick={() => { setHasData(false); setStudents([]); setEditedCells(new Set()); setError(null); }}
                  className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Load different file
                </button>
              </div>
            </div>

            {/* Parse warnings */}
            {parseErrors.length > 0 && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm">
                <p className="font-semibold mb-1">⚠️ {parseErrors.length} warning(s)</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {/* Editable hint */}
            <p className="text-xs text-gray-400 -mb-2">
              ✏️ Click any purple-highlighted cell to edit — totals recalculate automatically. A child with multiple
              subjects has the extra subjects on the rows below with the Student Name cell left blank (or merged) — they
              become a single invoice. Drag a column's right edge to resize it, like in Excel.
            </p>

            {/* Preview / edit table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="text-sm" style={{ tableLayout: "fixed", width: "100%", minWidth: colWidths.reduce((a, b) => a + b, 0) }}>
                  <colgroup>
                    {COLUMNS.map((c, i) => (
                      <col key={c.key} style={{ width: colWidths[i] }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr style={{ backgroundColor: "#AB33DA" }} className="text-white text-xs uppercase tracking-wide">
                      <th className="relative select-none px-3 py-3 text-center font-semibold">
                        #<ResizeHandle onMouseDown={(e) => startResize(0, e)} />
                      </th>
                      <th className="relative select-none px-3 py-3 text-center font-semibold">
                        Student<ResizeHandle onMouseDown={(e) => startResize(1, e)} />
                      </th>
                      <th className="relative select-none px-3 py-3 text-center font-semibold">
                        Parent<ResizeHandle onMouseDown={(e) => startResize(2, e)} />
                      </th>
                      <th className="relative select-none px-3 py-3 text-center font-semibold">
                        POC<ResizeHandle onMouseDown={(e) => startResize(3, e)} />
                      </th>
                      <th className="relative select-none px-3 py-3 text-center font-semibold">
                        Level<ResizeHandle onMouseDown={(e) => startResize(4, e)} />
                      </th>
                      <th className="relative select-none px-3 py-3 text-center font-semibold">
                        Subject<ResizeHandle onMouseDown={(e) => startResize(5, e)} />
                      </th>
                      {/* Editable columns — slightly tinted header */}
                      <th className="relative select-none px-2 py-3 text-center font-semibold bg-purple-700">
                        Rate/hr<ResizeHandle onMouseDown={(e) => startResize(6, e)} />
                      </th>
                      <th className="relative select-none px-2 py-3 text-center font-semibold bg-purple-700">
                        Dur (hr)<ResizeHandle onMouseDown={(e) => startResize(7, e)} />
                      </th>
                      <th className="relative select-none px-2 py-3 text-center font-semibold bg-purple-700">
                        Lessons<ResizeHandle onMouseDown={(e) => startResize(8, e)} />
                      </th>
                      <th className="relative select-none px-2 py-3 text-center font-semibold bg-purple-700">
                        Adjustment ($)<ResizeHandle onMouseDown={(e) => startResize(9, e)} />
                      </th>
                      <th className="relative select-none px-3 py-3 text-center font-semibold bg-purple-700">
                        Adjustment Notes<ResizeHandle onMouseDown={(e) => startResize(10, e)} />
                      </th>
                      {/* Calculated */}
                      <th className="relative select-none px-3 py-3 text-center font-semibold">
                        Subtotal<ResizeHandle onMouseDown={(e) => startResize(11, e)} />
                      </th>
                      <th className="relative select-none px-3 py-3 text-center font-semibold">
                        Child Total<ResizeHandle onMouseDown={(e) => startResize(12, e)} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {flat.map(({ child, childIdx, subjIdx, line }) => {
                      const edited = editedCells.has(`${childIdx}-${subjIdx}`);
                      const isFirst = subjIdx === 0;
                      const isLast  = subjIdx === child.subjects.length - 1;
                      return (
                        <tr
                          key={`${childIdx}-${subjIdx}`}
                          className={`${isFirst ? "border-t border-gray-200" : ""} transition-colors ${
                            edited ? "bg-yellow-50" : childIdx % 2 === 1 ? "bg-gray-50" : "bg-white"
                          } hover:bg-purple-50`}
                        >
                          <td className="px-3 py-2 text-center text-gray-400 text-xs overflow-hidden text-ellipsis">{isFirst ? child.serialNo : ""}</td>
                          <td className="px-3 py-2 text-center font-medium text-gray-800 whitespace-nowrap overflow-hidden text-ellipsis" title={isFirst ? child.studentName : undefined}>
                            {isFirst ? child.studentName : <span className="text-gray-300 text-xs">↳ same child</span>}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis" title={isFirst ? child.parentName : undefined}>{isFirst ? child.parentName : ""}</td>
                          <td className="px-3 py-2 text-center text-gray-500 font-mono text-xs whitespace-nowrap overflow-hidden text-ellipsis">{isFirst ? maskPoc(child.poc) : ""}</td>
                          <td className="px-3 py-2 text-center">
                            {isFirst && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "#EDE9F7", color: "#7B2FBE" }}>
                                {child.level}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-600">{line.subject}</td>

                          {/* ── Editable cells (light purple tint) ── */}
                          <td className="px-2 py-1 bg-purple-50">
                            <input
                              type="number" value={line.ratePerHour} min={0} step={1}
                              onChange={(e) => updateLine(childIdx, subjIdx, { ratePerHour: Number(e.target.value) })}
                              className={inputCls + " w-14"} title="Per hour rate"
                            />
                          </td>
                          <td className="px-2 py-1 bg-purple-50">
                            <select
                              value={line.durationHrs}
                              onChange={(e) => updateLine(childIdx, subjIdx, { durationHrs: Number(e.target.value) })}
                              className="w-full bg-transparent border-b border-transparent focus:border-purple-400 focus:outline-none text-center py-0.5 text-sm"
                            >
                              {[1, 1.5, 2, 2.5, 3].map((v) => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1 bg-purple-50">
                            <input
                              type="number" value={line.lessons} min={1} step={1}
                              onChange={(e) => updateLine(childIdx, subjIdx, { lessons: Number(e.target.value) })}
                              className={inputCls + " w-12"} title="Number of lessons"
                            />
                          </td>
                          <td className="px-2 py-1 bg-purple-50">
                            <input
                              type="number" value={line.adjustment} step={1}
                              onChange={(e) => updateLine(childIdx, subjIdx, { adjustment: Number(e.target.value) })}
                              className={inputCls + " w-16 text-center " + (line.adjustment < 0 ? "text-red-500" : line.adjustment > 0 ? "text-green-600" : "")}
                              title="Adjustment amount — type a minus sign to discount (e.g. -80 for missed lessons), or a plain number to add (e.g. 90 for an extra session). Printed on the invoice as a single Adjustment line."
                            />
                          </td>
                          <td className="px-2 py-1 bg-purple-50">
                            <textarea
                              value={line.adjustmentNotes}
                              onChange={(e) => updateLine(childIdx, subjIdx, { adjustmentNotes: e.target.value })}
                              placeholder="e.g. 2hr → 1.5hr from Wk 5…"
                              rows={1}
                              ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }}
                              onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }}
                              className="w-full bg-transparent border-b border-transparent focus:border-purple-400 focus:outline-none py-0.5 text-xs text-center text-gray-600 placeholder-gray-300 resize-none break-words leading-snug overflow-hidden"
                              title="Your own reference only — never printed on the invoice or receipt."
                            />
                          </td>

                          {/* ── Calculated (read-only) ── */}
                          <td className="px-3 py-2 text-center text-gray-700 font-medium">{fmtCurrency(line.subtotal)}</td>
                          <td className="px-3 py-2 text-center font-bold" style={{ color: "#AB33DA" }}>
                            {isLast ? fmtCurrency(child.totalFee) : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td colSpan={12} className="px-3 py-3 text-right font-semibold text-gray-700">Grand Total</td>
                      <td className="px-3 py-3 text-center font-bold text-lg" style={{ color: "#AB33DA" }}>
                        {fmtCurrency(grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Proceed */}
            <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-xl">
              <p className="text-sm text-purple-700">
                {editedCells.size > 0
                  ? `✏️ ${editedCells.size} row(s) edited. Changes will be reflected in the generated PDFs.`
                  : "✓ Preview looks correct? Proceed to generate one PDF per child."}
              </p>
              <div className="flex gap-3 ml-4 flex-shrink-0">
                <Link
                  href="/"
                  className="px-5 py-2 rounded-lg text-sm font-semibold border transition-colors hover:bg-purple-100"
                  style={{ borderColor: "#AB33DA", color: "#AB33DA" }}
                >
                  ← Return to Menu
                </Link>
                <button
                  onClick={() => {
                    sessionStorage.setItem("accel_students", JSON.stringify(students));
                    sessionStorage.setItem("accel_sheet", sheetName);
                    window.location.href = "/invoices";
                  }}
                  className="px-5 py-2 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#AB33DA" }}
                >
                  Generate Invoices →
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}
