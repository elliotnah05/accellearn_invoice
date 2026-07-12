"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TemplateConfig, ScheduleRow } from "@/app/api/config/route";

// ── Small reusable atoms ─────────────────────────────────────────────────────

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col gap-4">
      <div>
        <h2 className="font-bold text-gray-800 text-base">{title}</h2>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400";
const textareaCls = `${inputCls} resize-none leading-relaxed`;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [config, setConfig] = useState<TemplateConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setConfig(d as TemplateConfig))
      .catch(() => setError("Could not load the invoice template"));
  }, []);

  async function save() {
    if (!config) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch {
      setError("Failed to save — please try again");
    } finally {
      setSaving(false);
    }
  }

  // ── Schedule helpers ──────────────────────────────────────────────────────
  function updateScheduleRow(idx: number, patch: Partial<ScheduleRow>) {
    if (!config) return;
    const next = [...config.schedule];
    next[idx] = { ...next[idx], ...patch };
    setConfig({ ...config, schedule: next });
  }
  function addScheduleRow() {
    if (!config) return;
    setConfig({ ...config, schedule: [...config.schedule, { label: "Term", period: "", type: "term" }] });
  }
  function removeScheduleRow(idx: number) {
    if (!config) return;
    setConfig({ ...config, schedule: config.schedule.filter((_, i) => i !== idx) });
  }
  function moveScheduleRow(idx: number, dir: -1 | 1) {
    if (!config) return;
    const next = [...config.schedule];
    const t = idx + dir;
    if (t < 0 || t >= next.length) return;
    [next[idx], next[t]] = [next[t], next[idx]];
    setConfig({ ...config, schedule: next });
  }

  // ── Fee schedule helpers ──────────────────────────────────────────────────
  function updateFeeLine(idx: number, val: string) {
    if (!config) return;
    const next = [...config.feeScheduleLines];
    next[idx] = val;
    setConfig({ ...config, feeScheduleLines: next });
  }
  function addFeeLine() {
    if (!config) return;
    setConfig({ ...config, feeScheduleLines: [...config.feeScheduleLines, ""] });
  }
  function removeFeeLine(idx: number) {
    if (!config) return;
    setConfig({ ...config, feeScheduleLines: config.feeScheduleLines.filter((_, i) => i !== idx) });
  }
  function moveFeeLine(idx: number, dir: -1 | 1) {
    if (!config) return;
    const next = [...config.feeScheduleLines];
    const t = idx + dir;
    if (t < 0 || t >= next.length) return;
    [next[idx], next[t]] = [next[t], next[idx]];
    setConfig({ ...config, feeScheduleLines: next });
  }

  // ── Loading / error states ────────────────────────────────────────────────
  if (!config && !error) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading invoice template…</p>
      </main>
    );
  }

  const SaveBtn = ({ small }: { small?: boolean }) => (
    <button
      onClick={save}
      disabled={saving}
      className={`rounded-lg font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 ${
        small
          ? "px-5 py-2 text-sm bg-white"
          : "px-6 py-2.5 text-sm text-white"
      }`}
      style={small ? { color: "#AB33DA" } : { backgroundColor: "#AB33DA" }}
    >
      {saving ? "Saving…" : "Save Changes"}
    </button>
  );

  return (
    <main className="min-h-screen flex flex-col">
      {/* Saved confirmation banner */}
      {saved && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
          <span>✓ Changes have been saved</span>
          <Link
            href="/"
            className="px-3 py-1 rounded-lg bg-white text-green-700 text-xs font-semibold hover:bg-green-50 transition-colors whitespace-nowrap"
          >
            ← Return to Menu
          </Link>
          <button
            onClick={() => setSaved(false)}
            className="opacity-70 hover:opacity-100 leading-none"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <header style={{ backgroundColor: "#AB33DA" }} className="px-8 py-4 flex items-center gap-3 shadow">
        <Link href="/" className="text-white opacity-70 hover:opacity-100 text-sm">← Back</Link>
        <div className="w-px h-5 bg-purple-300 mx-1" />
        <h1 className="text-white font-bold">Invoice Template</h1>
        <div className="ml-auto flex items-center gap-3">
          <SaveBtn small />
        </div>
      </header>

      <div className="flex-1 px-8 py-8 max-w-2xl mx-auto w-full flex flex-col gap-5">

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

        {config && (
          <>
            {/* ── 0. Folders ── */}
            <SectionCard
              title="Folders"
              hint="Where generated PDFs are saved, and which Excel file receipt statuses are written back to. Use a OneDrive/Google Drive-synced folder to share with the owner."
            >
              <Field label="Output folder for invoices & receipts">
                <input
                  type="text"
                  value={config.outputFolder ?? ""}
                  onChange={(e) => setConfig({ ...config, outputFolder: e.target.value })}
                  placeholder="e.g. C:\Users\you\OneDrive\AccelLearn\Billing"
                  className={`${inputCls} font-mono`}
                />
              </Field>
              <Field label="Master spreadsheet file (for receipt status write-back)">
                <input
                  type="text"
                  value={config.spreadsheetPath ?? ""}
                  onChange={(e) => setConfig({ ...config, spreadsheetPath: e.target.value })}
                  placeholder="e.g. C:\Users\you\OneDrive\AccelLearn\student details NEW.xlsx"
                  className={`${inputCls} font-mono`}
                />
              </Field>
            </SectionCard>

            {/* ── 1. Company details ── */}
            <SectionCard title="Company Details" hint="Shown in clause 6 (PayNow) of every invoice.">
              <Field label="Company Name">
                <input
                  type="text"
                  value={config.companyName}
                  onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="PayNow UEN">
                <input
                  type="text"
                  value={config.payNowUEN}
                  onChange={(e) => setConfig({ ...config, payNowUEN: e.target.value })}
                  className={`${inputCls} font-mono`}
                />
              </Field>
            </SectionCard>

            {/* ── 2. Clause 1 ── */}
            <SectionCard title="Clause 1 — Term Structure" hint="Appears as clause 1 in the T&C section.">
              <Field label="Clause text">
                <textarea
                  rows={3}
                  value={config.clause1}
                  onChange={(e) => setConfig({ ...config, clause1: e.target.value })}
                  className={textareaCls}
                />
              </Field>
            </SectionCard>

            {/* ── 3. Term Schedule ── */}
            <SectionCard title="Clause 2 — Term Schedule" hint="Rendered as a table in the invoice. Update at the start of each academic year.">
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-[76px_1fr_158px_72px] gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
                  <span>Type</span><span>Label</span><span>Period (dates)</span><span></span>
                </div>
                {config.schedule.map((row, i) => (
                  <div key={i} className="grid grid-cols-[76px_1fr_158px_72px] gap-2 items-center">
                    <select
                      value={row.type}
                      onChange={(e) => updateScheduleRow(i, { type: e.target.value as "term" | "break" })}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-purple-400 bg-white"
                    >
                      <option value="term">Term</option>
                      <option value="break">Break</option>
                    </select>
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) => updateScheduleRow(i, { label: e.target.value })}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-purple-400"
                      placeholder="e.g. Term 1"
                    />
                    <input
                      type="text"
                      value={row.period}
                      onChange={(e) => updateScheduleRow(i, { period: e.target.value })}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-purple-400"
                      placeholder="e.g. 3/11/25 to 8/2/26"
                    />
                    <div className="flex gap-1">
                      <button onClick={() => moveScheduleRow(i, -1)} disabled={i === 0}
                        className="px-2 py-1 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30 text-xs" title="Move up">↑</button>
                      <button onClick={() => moveScheduleRow(i, 1)} disabled={i === config.schedule.length - 1}
                        className="px-2 py-1 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30 text-xs" title="Move down">↓</button>
                      <button onClick={() => removeScheduleRow(i)}
                        className="px-2 py-1 rounded text-red-300 hover:bg-red-50 hover:text-red-500 text-xs" title="Remove">✕</button>
                    </div>
                  </div>
                ))}
                <button onClick={addScheduleRow}
                  className="mt-1 px-4 py-2 border border-dashed border-purple-300 rounded-lg text-sm text-purple-500 hover:bg-purple-50 transition-colors">
                  + Add row
                </button>
              </div>
            </SectionCard>

            {/* ── 4. Clause 3 — Fee schedule ── */}
            <SectionCard
              title="Clause 3 — Fee Schedule"
              hint="The intro line + each bullet below is shown verbatim in the invoice. Edit rates here — no code needed."
            >
              <Field label="Intro line (clause 3 opening text)">
                <input
                  type="text"
                  value={config.feeScheduleIntro}
                  onChange={(e) => setConfig({ ...config, feeScheduleIntro: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Fee lines (one per row)">
                <div className="flex flex-col gap-2">
                  {config.feeScheduleLines.map((line, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={line}
                        onChange={(e) => updateFeeLine(i, e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-purple-400"
                        placeholder="e.g. P3 and P4: $35/hour…"
                      />
                      <button onClick={() => moveFeeLine(i, -1)} disabled={i === 0}
                        className="px-2 py-1 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30 text-xs" title="Move up">↑</button>
                      <button onClick={() => moveFeeLine(i, 1)} disabled={i === config.feeScheduleLines.length - 1}
                        className="px-2 py-1 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30 text-xs" title="Move down">↓</button>
                      <button onClick={() => removeFeeLine(i)}
                        className="px-2 py-1 rounded text-red-300 hover:bg-red-50 hover:text-red-500 text-xs" title="Remove">✕</button>
                    </div>
                  ))}
                  <button onClick={addFeeLine}
                    className="mt-1 px-4 py-2 border border-dashed border-purple-300 rounded-lg text-sm text-purple-500 hover:bg-purple-50 transition-colors">
                    + Add fee line
                  </button>
                </div>
              </Field>
            </SectionCard>

            {/* ── 5. Clause 4 ── */}
            <SectionCard title="Clause 4 — Makeup Policy" hint="Appears as clause 4 in the T&C section.">
              <Field label="Clause text">
                <textarea
                  rows={3}
                  value={config.clause4}
                  onChange={(e) => setConfig({ ...config, clause4: e.target.value })}
                  className={textareaCls}
                />
              </Field>
            </SectionCard>

            {/* ── Save bar ── */}
            <div className="flex justify-end pb-8">
              <SaveBtn />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
