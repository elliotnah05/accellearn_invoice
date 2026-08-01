"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Student, ParseResult } from "@/types/student";
import { receiptState } from "@/lib/receipt-status";

function fmtCurrency(n: number) {
  return `$${n.toFixed(2)}`;
}

/** Non-empty and not an explicit "no" = yes. Shared rule for the Paid (M) and
 *  Invoice Issued (L) columns — see the guide's "Paid rule". */
function isYes(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v !== "" && v !== "no" && v !== "n" && v !== "false" && v !== "0";
}

function isPaid(s: Student): boolean {
  return isYes(s.paid);
}

function isInvoiced(s: Student): boolean {
  return isYes(s.invoiceIssued);
}

export default function StatusPage() {
  const [students, setStudents]   = useState<Student[]>([]);
  const [sheetName, setSheetName] = useState("");

  useEffect(() => {
    (async () => {
      let list: Student[] = [];
      let sheet = "";
      // Preferred: live read from the master sheet; fallback: session data
      try {
        const res = await fetch("/api/students");
        if (res.ok) {
          const data = (await res.json()) as ParseResult;
          list = data.students;
          sheet = data.sheetName;
        }
      } catch { /* fall through */ }
      if (list.length === 0) {
        try {
          const raw = sessionStorage.getItem("accel_students");
          const s   = sessionStorage.getItem("accel_sheet");
          if (raw) list = JSON.parse(raw);
          if (s)   sheet = s;
        } catch { /* sessionStorage unavailable */ }
      }
      setStudents(list);
      setSheetName(sheet);
    })();
  }, []);

  if (students.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No student data found. Import the latest sheet first.</p>
          <Link href="/import" className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: "#AB33DA" }}>
            ← Go to Import
          </Link>
        </div>
      </main>
    );
  }

  // Every figure here comes from the spreadsheet — the same source the Invoices
  // and Receipts pages read. The per-machine ledger is deliberately NOT used:
  // it's empty on a fresh install (a new admin, or the owner after handover),
  // which used to make this page report zero receipts while the Receipts page
  // — correctly reading the sheet — showed them as issued and sent.
  const invoiced   = students.filter(isInvoiced);
  const paid       = students.filter(isPaid);
  const generated  = students.filter((s) => receiptState(s));
  const sent       = students.filter((s) => receiptState(s)?.sent);
  const totalDue   = students.reduce((t, s) => t + s.totalFee, 0);
  const totalPaid  = paid.reduce((t, s) => t + s.totalFee, 0);

  return (
    <main className="min-h-screen flex flex-col">
      <header style={{ backgroundColor: "#AB33DA" }} className="px-8 py-4 flex items-center gap-3 shadow">
        <Link href="/" className="text-white opacity-70 hover:opacity-100 text-sm">← Back</Link>
        <div className="w-px h-5 bg-purple-300 mx-1" />
        <h1 className="text-white font-bold">Phase 5 — Status Overview</h1>
        <span className="ml-auto text-purple-200 text-sm">{sheetName}</span>
      </header>

      <div className="flex-1 px-8 py-8 max-w-4xl mx-auto w-full flex flex-col gap-5">

        {/* Totals */}
        <div className="grid grid-cols-6 gap-3">
          {[
            { label: "Students",        value: String(students.length),            cls: "text-gray-800"  },
            { label: "Invoiced total",  value: fmtCurrency(totalDue),              cls: ""               },
            { label: "Invoices issued", value: String(invoiced.length),            cls: "text-blue-600"  },
            { label: "Paid",            value: `${paid.length} · ${fmtCurrency(totalPaid)}`, cls: "text-green-600" },
            { label: "Receipts made",   value: String(generated.length),           cls: "text-blue-600"  },
            { label: "Receipts sent",   value: String(sent.length),                cls: "text-green-600" },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{c.label}</p>
              <p className={`font-bold text-lg mt-0.5 ${c.cls}`} style={c.cls === "" ? { color: "#AB33DA" } : undefined}>
                {c.value}
              </p>
            </div>
          ))}
        </div>

        {/* Per-student table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#AB33DA" }} className="text-white text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-semibold">#</th>
                <th className="px-4 py-3 text-left font-semibold">ID</th>
                <th className="px-4 py-3 text-left font-semibold">Student</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 text-center font-semibold">Invoiced</th>
                <th className="px-4 py-3 text-center font-semibold">Paid</th>
                <th className="px-4 py-3 text-center font-semibold">Receipt</th>
                <th className="px-4 py-3 text-center font-semibold">Sent to parent</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const rs = receiptState(s);
                return (
                  <tr key={s.studentId || `#${s.serialNo}`} className={`border-t border-gray-100 ${i % 2 === 1 ? "bg-gray-50" : "bg-white"}`}>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{s.serialNo}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs font-mono">{s.studentId || "—"}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">{s.studentName}</td>
                    <td className="px-4 py-2.5 text-right font-bold" style={{ color: "#AB33DA" }}>{fmtCurrency(s.totalFee)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {isInvoiced(s)
                        ? <span className="text-blue-600 text-xs font-semibold">✓</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {isPaid(s)
                        ? <span className="text-green-600 text-xs font-semibold">✓ {s.dateOfReceipt || "Paid"}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {rs?.receiptNo
                        ? <span className="text-blue-600 text-xs font-mono">{rs.receiptNo}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {rs?.sent
                        ? <span className="text-green-600 text-xs font-semibold">✓ {rs.sent}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-center gap-6 pb-6">
          <Link href="/receipts" className="text-sm text-gray-400 hover:text-gray-600">← Back to Receipts</Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">↩ Return to Menu</Link>
        </div>
      </div>
    </main>
  );
}
