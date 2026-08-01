"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Student } from "@/types/student";

function fmtCurrency(n: number) {
  return `$${n.toFixed(2)}`;
}

function maskPoc(poc: string): string {
  return poc.replace(/(\+\d{2})\s?(\d{2})(\d{3})(\d{4})/, "$1 $2XXX $4");
}

type SendState = "ready" | "sending" | "sent" | "failed";

/** Stable per-child key — Student ID, or serial as a last-resort fallback. */
function sKey(s: { studentId?: string; serialNo: number }): string {
  return s.studentId || `#${s.serialNo}`;
}

interface SendStatus {
  state: SendState;
  error?: string;
  messageId?: string;
  sentAt?: string;
}

interface ApiStatus {
  configured: boolean;
  templateMode: boolean;
  templateName: string | null;
}

const STATUS_KEY = "accel_send_status";

export default function SendPage() {
  const [students, setStudents]   = useState<Student[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [api, setApi]             = useState<ApiStatus | null>(null);
  const [statuses, setStatuses]   = useState<Record<string, SendStatus>>({});
  const [bulkRunning, setBulkRunning] = useState(false);
  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;

  useEffect(() => {
    try {
      const raw   = sessionStorage.getItem("accel_approved");
      const sheet = sessionStorage.getItem("accel_sheet");
      const saved = sessionStorage.getItem(STATUS_KEY);
      if (raw)   setStudents(JSON.parse(raw));
      if (sheet) setSheetName(sheet);
      if (saved) {
        // Restore, but downgrade any interrupted "sending" back to ready
        const parsed = JSON.parse(saved) as Record<string, SendStatus>;
        for (const k of Object.keys(parsed)) {
          if (parsed[k].state === "sending") parsed[k] = { state: "ready" };
        }
        setStatuses(parsed);
      }
    } catch { /* sessionStorage unavailable */ }

    fetch("/api/send")
      .then((r) => r.json())
      .then(setApi)
      .catch(() => setApi({ configured: false, templateMode: false, templateName: null }));
  }, []);

  function updateStatus(key: string, status: SendStatus) {
    setStatuses((prev) => {
      const next = { ...prev, [key]: status };
      try { sessionStorage.setItem(STATUS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  async function sendOne(student: Student): Promise<boolean> {
    updateStatus(sKey(student), { state: "sending" });
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(student),
      });
      const body = await res.json();
      if (res.ok && body.ok) {
        updateStatus(sKey(student), { state: "sent", messageId: body.messageId, sentAt: body.sentAt });
        return true;
      }
      updateStatus(sKey(student), { state: "failed", error: body.error ?? "Send failed" });
      return false;
    } catch {
      updateStatus(sKey(student), { state: "failed", error: "Network error — is the dev server running?" });
      return false;
    }
  }

  async function sendAll() {
    setBulkRunning(true);
    for (const s of students) {
      const current = statusesRef.current[sKey(s)]?.state;
      if (current === "sent" || current === "sending") continue;
      await sendOne(s);
      // Gentle pacing so we stay well under Meta rate limits
      await new Promise((r) => setTimeout(r, 1000));
    }
    setBulkRunning(false);
  }

  if (students.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No approved invoices found. Please complete Phase 3 first.</p>
          <Link href="/invoices" className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: "#AB33DA" }}>
            ← Back to Review
          </Link>
        </div>
      </main>
    );
  }

  const sentCount   = students.filter((s) => statuses[sKey(s)]?.state === "sent").length;
  const failedCount = students.filter((s) => statuses[sKey(s)]?.state === "failed").length;
  const allDone     = sentCount === students.length;

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header style={{ backgroundColor: "#AB33DA" }} className="px-8 py-4 flex items-center gap-3 shadow">
        <Link href="/invoices" className="text-white opacity-70 hover:opacity-100 text-sm">← Back to Review</Link>
        <div className="w-px h-5 bg-purple-300 mx-1" />
        <h1 className="text-white font-bold">Phase 4 — Send via WhatsApp</h1>
        <span className="ml-auto text-purple-200 text-sm">{sheetName}</span>
      </header>

      <div className="flex-1 px-8 py-8 max-w-3xl mx-auto w-full flex flex-col gap-5">

        {/* Credentials / mode banner */}
        {api && !api.configured && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-5">
            <h3 className="font-bold text-amber-800 mb-1">⚙️ WhatsApp not configured yet</h3>
            <p className="text-sm text-amber-700">
              Fill in <code className="bg-amber-100 px-1 rounded">app/.env.local</code> with your Meta Cloud API
              credentials, then restart the dev server. Full walkthrough in{" "}
              <code className="bg-amber-100 px-1 rounded">SETUP_WHATSAPP.md</code>.
            </p>
          </div>
        )}
        {api?.configured && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center gap-2">
            <span>✅</span>
            <p className="text-sm text-green-700">
              WhatsApp connected —{" "}
              {api.templateMode
                ? <>sending via template <strong>{api.templateName}</strong></>
                : <>free-form document mode (only delivers if the parent messaged you in the last 24h)</>}
            </p>
          </div>
        )}

        {/* Queue */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-gray-800">Send Queue</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {sentCount}/{students.length} sent
                {failedCount > 0 && <span className="text-red-500"> · {failedCount} failed</span>}
              </p>
            </div>
            <span className="text-2xl font-bold" style={{ color: "#AB33DA" }}>
              {fmtCurrency(students.reduce((s, r) => s + r.totalFee, 0))}
            </span>
          </div>

          <div className="flex flex-col divide-y divide-gray-100">
            {students.map((s) => {
              const st = statuses[sKey(s)] ?? { state: "ready" as SendState };
              return (
                <div key={sKey(s)} className="py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{s.studentName}</p>
                    <p className="text-xs text-gray-400">{s.parentName} · {maskPoc(s.poc)}</p>
                    {st.state === "failed" && st.error && (
                      <p className="text-xs text-red-500 mt-0.5">✗ {st.error}</p>
                    )}
                  </div>
                  <p className="font-bold text-sm shrink-0" style={{ color: "#AB33DA" }}>{fmtCurrency(s.totalFee)}</p>
                  <div className="w-24 text-right shrink-0">
                    {st.state === "sent" && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100" style={{ color: "#49A078" }}>
                        ✓ Sent
                      </span>
                    )}
                    {st.state === "sending" && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-purple-100 text-purple-600 animate-pulse">
                        Sending…
                      </span>
                    )}
                    {(st.state === "ready" || st.state === "failed") && (
                      <button
                        onClick={() => sendOne(s)}
                        disabled={!api?.configured || bulkRunning}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
                        style={{ backgroundColor: st.state === "failed" ? "#EF4444" : "#AB33DA" }}
                      >
                        {st.state === "failed" ? "Retry" : "Send"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bulk send */}
        <button
          onClick={sendAll}
          disabled={!api?.configured || bulkRunning || allDone}
          className="w-full py-3 rounded-xl text-white font-bold shadow disabled:opacity-40"
          style={{ backgroundColor: allDone ? "#49A078" : "#AB33DA" }}
        >
          {allDone
            ? "🎉 All invoices sent"
            : bulkRunning
              ? "Sending…"
              : `📲 Send All (${students.length - sentCount} remaining)`}
        </button>

        {allDone && (
          <Link
            href="/"
            className="w-full py-3 rounded-xl text-center font-bold border transition-colors hover:bg-purple-50"
            style={{ borderColor: "#AB33DA", color: "#AB33DA" }}
          >
            ← Return to Menu
          </Link>
        )}

        <div className="flex items-center justify-center gap-6">
          <Link href="/invoices" className="text-sm text-gray-400 hover:text-gray-600 text-center">
            ← Go back and adjust approvals
          </Link>
          {!allDone && (
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 text-center">
              ↩ Return to Menu
            </Link>
          )}
        </div>

      </div>
    </main>
  );
}
