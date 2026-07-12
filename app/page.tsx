"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

type Mode = "invoices" | "receipts";

type Step = { num: number; label: string; href: string; desc: string };

const WORKFLOWS: Record<Mode, { heading: string; blurb: string; steps: Step[] }> = {
  invoices: {
    heading: "Invoice Workflow",
    blurb: "Import the sheet, review each invoice, then export the PDFs to the shared folder.",
    steps: [
      { num: 1, label: "Import Sheet",      href: "/import",   desc: "Upload Excel, preview all students & calculated totals" },
      { num: 2, label: "Generate Invoices", href: "/import",   desc: "PDFs are generated on-demand during review — start by importing a sheet" },
      { num: 3, label: "Review & Approve",  href: "/invoices", desc: "Preview each invoice, approve or flag, then export PDFs to the shared folder" },
    ],
  },
  receipts: {
    heading: "Receipt Workflow",
    blurb: "Issue receipts for students who have paid — duplicates are blocked automatically.",
    steps: [
      { num: 1, label: "Generate Receipts", href: "/receipts", desc: "Make receipts for paid students, then mark them as sent — re-issues never create a duplicate" },
    ],
  },
};

export default function Home() {
  const [mode, setMode] = useState<Mode>("invoices");
  const wf = WORKFLOWS[mode];

  return (
    <main className="min-h-screen flex flex-col">
      <header style={{ backgroundColor: "#AB33DA" }} className="px-8 py-4 flex items-center gap-4 shadow">
        <Image src="/logo.png" alt="AccelLearn" width={48} height={48} className="rounded" />
        <div>
          <h1 className="text-white font-bold text-xl tracking-wide">AccelLearn</h1>
          <p className="text-purple-200 text-xs">Billing Management System</p>
        </div>
        <div className="ml-auto flex items-center gap-5">
          <Link href="/status" className="text-purple-200 hover:text-white text-sm transition-colors">
            📊 Status
          </Link>
          <Link href="/settings" className="text-purple-200 hover:text-white text-sm transition-colors">
            ⚙ Settings
          </Link>
        </div>
      </header>

      {/* Invoice / Receipt toggle */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex justify-center">
        <div className="inline-flex rounded-xl border border-purple-200 bg-purple-50 p-1" role="tablist" aria-label="Process">
          {(["invoices", "receipts"] as Mode[]).map((m) => {
            const selected = mode === m;
            return (
              <button
                key={m}
                role="tab"
                aria-selected={selected}
                onClick={() => setMode(m)}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                  selected ? "text-white shadow-sm" : "text-purple-700 hover:text-purple-900"
                }`}
                style={selected ? { backgroundColor: "#AB33DA" } : undefined}
              >
                {m === "invoices" ? "Invoices" : "Receipts"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 px-8 py-10 max-w-3xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">{wf.heading}</h2>
        <p className="text-gray-500 text-sm mb-8">{wf.blurb}</p>

        <div className="flex flex-col gap-5">
          {wf.steps.map((p) => (
            <div
              key={p.num}
              className="flex items-center gap-5 rounded-xl border border-purple-300 bg-white shadow-sm hover:shadow-md p-5 transition-all"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ backgroundColor: "#AB33DA" }}
              >
                {p.num}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{p.label}</p>
                <p className="text-sm text-gray-500">{p.desc}</p>
              </div>
              <Link
                href={p.href}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#AB33DA" }}
              >
                Open →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
