"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Student, ParseResult } from "@/types/student";
import type { LedgerEntry } from "@/lib/billing-store";

function fmtCurrency(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
}

function isPaid(s: Student): boolean {
  const v = s.paid.trim().toLowerCase();
  return v !== "" && v !== "no" && v !== "n" && v !== "false" && v !== "0";
}

export default function StatusPage() {
  const [students, setStudents]   = useState<Student[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [entries, setEntries]     = useState<Record<number, LedgerEntry>>({});

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
      if (sheet) {
        fetch(`/api/receipts?term=${encodeURIComponent(sheet)}`)
          .then((r) => r.json())
          .then((body) => {
            const map: Record<number, LedgerEntry> = {};
            for (const e of body.entries as LedgerEntry[]) map[e.serialNo] = e;
            setEntries(map);
          })
          .catch(() => {});
      }
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

  const paid       = students.filter(isPaid);
  const generated  = students.filter((s) => entries[s.serialNo]);
  const sent       = students.filter((s) => entries[s.serialNo]?.sentAt);
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
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Students",        value: String(students.length),            cls: "text-gray-800"  },
            { label: "Invoiced total",  value: fmtCurrency(totalDue),              cls: ""               },
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
                <th className="px-4 py-3 text-left font-semibold">Student</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 text-center font-semibold">Paid</th>
                <th className="px-4 py-3 text-center font-semibold">Receipt</th>
                <th className="px-4 py-3 text-center font-semibold">Sent to parent</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const e = entries[s.serialNo];
                return (
                  <tr key={s.serialNo} className={`border-t border-gray-100 ${i % 2 === 1 ? "bg-gray-50" : "bg-white"}`}>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{s.serialNo}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">{s.studentName}</td>
                    <td className="px-4 py-2.5 text-right font-bold" style={{ color: "#AB33DA" }}>{fmtCurrency(s.totalFee)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {isPaid(s)
                        ? <span className="text-green-600 text-xs font-semibold">✓ {s.dateOfReceipt || "Paid"}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {e
                        ? <span className="text-blue-600 text-xs font-mono">{e.receiptNo}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {e?.sentAt
                        ? <span className="text-green-600 text-xs font-semibold">✓ {fmtDate(e.sentAt)}</span>
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
