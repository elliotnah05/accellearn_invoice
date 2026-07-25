# AccelLearn Invoices & Receipts — Owner & Admin Guide

**App:** AccelLearn Invoices (Windows & Mac desktop app)
**Last updated:** 24 July 2026 (v0.10.1)
**Who it's for:** The centre owner and any admin who runs billing. Keep this file in the shared Google Drive folder and hand it to every new admin. New to the app? Read sections 1–4 in order. A short version history is at the very end.

---

## 1. What this app does

The app mass-generates **invoice PDFs** and **receipt PDFs** for every student, straight into the shared Google Drive folder. It reads one master Excel spreadsheet **live** — you keep editing that spreadsheet in Excel as normal, and the app always shows the latest data. Nothing is uploaded or synced by hand.

**You send the PDFs to parents yourself** (e.g. via WhatsApp). The app only creates the files and records what's been issued and sent.

> **The cycle:** edit the spreadsheet → app generates invoices into Drive → you send them → parent pays → you mark **Paid** in the spreadsheet → app generates the receipt → you send it → click **Mark as Sent**.

The spreadsheet is the **single source of truth**; the app turns it into PDFs and records receipt status back into it.

---

## 2. First-time setup (once per computer)

**1 — Get folder access.** The owner shares the Drive folder **`accellearn-invoice-reciept`** with your Google account. It holds the master spreadsheet, all PDFs, and this guide.

**2 — Install Google Drive for desktop** (google.com/drive/download) and sign in. This makes the folder appear as a **real folder** on your computer — the app opens the spreadsheet as a file, so a browser tab is not enough.

> ⚠️ **The step almost everyone misses.** If the folder was *shared with* you, it lands under **"Shared with me"**, which does **not** sync to your computer — so the app can't find the spreadsheet. Fix once: Google Drive in a browser → **Shared with me** → right-click the folder → **Organise → Add shortcut to Drive** → **My Drive** → Add. (Owners already have it in My Drive — skip this.)
>
> **Recommended:** right-click the folder → **Offline access → Available offline**, so it works without internet and reads faster.

**3 — Find the folder's path.** Usually `G:\My Drive\accellearn-invoice-reciept` on Windows (**the drive letter differs per computer**); on Mac, `~/Library/CloudStorage/GoogleDrive-<email>/My Drive/…`. Open the folder and copy the path from the address bar (Windows) or *Get Info* (Mac).

**4 — Install the app.** Both installers are in the Drive folder under **`App Installer`** (with a READ ME).
- **Windows:** run `AccelLearn-Invoices-Setup.exe`. The blue "Windows protected your PC" warning is expected (unsigned) → **More info → Run anyway** → Next → Install.
- **Mac:** open `AccelLearn-Invoices.dmg`, drag to Applications. First launch is blocked ("Apple could not verify…") → **System Settings → Privacy & Security → Open Anyway**. Once only.

**5 — Point the app at the folder.** App → **Settings → Folders**:
- **Output folder** = the shared Drive folder (from step 3)
- **Spreadsheet path** = that folder + `\student details LATEST.xlsx`

Stored per computer, so every machine does this once.

**6 — Check.** The home page shows a green **"Connected — N students"** banner. Amber instead? See Troubleshooting (§8).

---

## 3. Using the app day-to-day

The home page has an **Invoices | Receipts** toggle, with **Status** and **Settings** top-right, and a green/amber "Connected" banner showing whether the app can see the spreadsheet.

Both the Invoices and Receipts pages have a **Term sheet dropdown** — it lists every term tab in the workbook (e.g. `AY 26 T2`, `AY 26 T3`, …) so you choose which term to work on. It updates itself as you add term tabs.

### Invoices

1. **Load Master Sheet** — pulls the live spreadsheet. Pick the term in the dropdown. The table is editable (rate, duration, lessons, material fee); edited rows turn yellow and totals recalc live.
   ⚠️ **These edits do NOT change the spreadsheet** — they only affect the PDFs generated right now. For a permanent change (rate, duration), edit the **spreadsheet**.
2. **Generate Invoices** — one PDF per child (a child with two subjects gets **one** invoice with a line per subject).
3. **Review & Approve** — each row has **Preview** (see the exact PDF first), then **Approve ✓** or **Flag ⚠** (with a note). A student with **Lessons = 0** this term is treated as *not enrolled* and moved to a grey **"Not billed this term"** panel — no invoice, not counted.
4. **Export** — approved invoices are saved to **`Invoices\<term>\`**. Use **Open folder**, then send each PDF to the parent.

### Receipts

1. A child becomes **ready for a receipt** once their **Paid** cell (column M) is filled in. Pick the term in the dropdown.
2. **Preview** shows the exact receipt PDF — nothing is saved, no number used.
3. **Generate** writes the PDF to **`Receipts\<term>\`** and stamps **column O (Receipt Issued)** with the number + date (cell turns **red** = issued, not yet sent).
4. **Mark as Sent** after you send it — the app writes **column R (Receipt Sent)** and turns column O **green**. (If the file is open in Excel, the app can't write and warns you — close Excel and click again; the PDF is still made.)

Receipt numbers are automatic and fixed — `R-AY26T3-013` = term AY 26 T3, serial 13. Re-generating the same receipt keeps the same number and overwrites the same file, so you can never get two conflicting receipts.

**Status lives in the spreadsheet, and syncs both ways.** The app reads receipt status from columns **O** and **R** — so it's identical on every computer, and **editing those cells in Excel changes what the app shows** (on the next ⟳ Refresh). Clear **R** to un-send; clear **both O and R** to fully cancel a receipt. Clearing them doesn't delete the PDF already in the folder — it just frees the row to be issued again. (See the cancellation note in §8.)

### Status

A read-only overview: who's invoiced / paid / has a receipt issued / sent, with count tiles.

### Settings — the invoice template

Everything on the invoice that isn't per-student, editable here (applies to the next PDF, no restart):
- **Folders** — the two paths from §2.
- **Company Details** — Company Name + PayNow UEN (must be the **registered** business name the UEN belongs to).
- **Clause 1 Term Structure**, **Clause 2 Term Schedule** (terms + holiday weeks — update each academic year; the receipt's "term ending on" date comes from the matching row's "… to <date>"), **Clause 3 Fee Schedule**, **Clause 4 Makeup Policy**.

Click **Save Changes** (green tick confirms). Tip: after any change, Preview one invoice before a mass run.

---

## 4. The spreadsheet — the rules that keep it working

The file is **`student details LATEST.xlsx`**. It has a **`Master`** tab and **one tab per term**:

| Tab | Holds | You edit |
|---|---|---|
| **`Master`** (first tab) | Columns **A–H only** — details that stay the same term to term (name, parent, level, subject, rate) | The one and only place a student is typed in |
| **Term tabs** (`AY 26 T2`, `T3`, `T4`, …) | **A–H auto-pulled from Master** + **I–R** for that term (lessons, material fee, paid, receipts) | **I–R only** — A–H look after themselves |

> **Golden rule:** type student details on **Master**; type each term's billing on that **term tab (I–R)**; never touch A–H on a term tab — they mirror Master by formula.

**Which term the app uses:** whatever you pick in the **Term sheet dropdown**. The default on open is the first tab after Master, so keep the current term right after Master if you like — but the dropdown reaches any term. (Master is never billable — it has no fees.)

### `Master` tab — columns A–H

One row per **subject**. A child with two subjects has two rows, A–E merged across them (see merged-cell rule).

| Col | Field | Example | Notes |
|---|---|---|---|
| A | Serial No | `15` | **Unique per child.** Never reuse |
| B | Student Name | `Jayden Tan` | Child's **first** row only |
| C | Parent Name | `Mrs Tan` | Printed on invoice & receipt |
| D | School | `Raffles Institution` | Admin reference only — not printed anywhere, no logic reads it |
| E | Level | `Sec 3` | Printed as the child's level |
| F | Subject | `Mathematics` | One per row |
| G | Duration (hrs) | `2` | Blank = 2 |
| H | Rate/hr ($) | `55` | Number only. **Required** |

Add a student = type them into the next free Master row (linked down to **row 500**).

### Term tab — columns I–R

A–H are formulas from Master. Fill in I–R for the term:

| Col | Field | Example | Notes |
|---|---|---|---|
| I | Lessons | `12` | **Blank = 12.** A number bills that many (`6` for a mid-term joiner). **`0` = not enrolled this term** (skipped from the run) |
| J | Material Fee ($) | `-80` or `90` | One figure, ± . Minus discounts, plain number adds. Prints as one "Material Fee" line. Blank/`0` = none |
| K | Material Fee Notes | `2 lessons missed` | **Internal only — never printed.** Your reminder of why J is what it is |
| L | Invoice Issued | *app writes* | `Yes` — stamped automatically the moment the app exports that child's invoice to the shared folder |
| M | Paid | `yes` / `PayNow` / `13/7/26` | Anything except empty/no = paid — see **Paid rule** |
| N | Date of Receipt | `13/7/26` | **Prints on the receipt** ("received a payment … on 13/07/26") |
| O | Receipt Issued | *app writes* | `R-AY26T3-015 · 14/07/26`; red (issued) → green (sent). Clear it to cancel — see §8 |
| P | Different End Date | `2/8/26` | Only if a child ends early/late — **prints as their term-end on the receipt** |
| Q | Backed Up | `yes` | Your own tracking |
| R | Receipt Sent | *app writes* | `Sent 14/07/26`. Clear it to un-send — see §8 |

### How a bill is worked out

```
Lesson Fee  = Rate/hr (H) × Duration (G) × Lessons (I)
Subtotal    = Lesson Fee + Material Fee (J)      ← a negative Material Fee subtracts
Grand Total = all of the child's subject Subtotals added up
```

Example — a two-subject child:

| | Maths | Science |
|---|---|---|
| Rate × Duration × Lessons | $40 × 2 × 12 = **$960** | $40 × 1.5 × 12 = **$720** |
| Material Fee (J) | **+$45** (book) | **−$75** (shorter lessons) |
| **Subtotal** | **$1,005** | **$645** |

**Grand Total = $1,650.** The invoice shows a Lesson Fee + Material Fee line per subject; column K notes never appear. Negative material fees print as `-$75.00`.

### Dates

- Type naturally — `13/7/26`, Enter. Keep **day/month/year** (Singapore); avoid `7/13/26`.
- The two dates parents see are **N (Date of Receipt)** and **P (Different End Date)** — both print on the receipt, so double-check them.
- A date showing as a number like `46216`? You're on an outdated app — install the current one.

### Two subjects — the merged-cell rule

One row = one subject; two subjects = two rows.

**On Master:** put the child's details (A–E) on the **first** row only, and **merge A–E** down across both rows (or at least leave **Student Name blank** on the extra row — that blank is how the app knows "same child, another subject"). Keep **F, G, H** filled on every row (they differ per subject).

**On the term tab:** nothing to do — A–H come through as formulas (the continuation row comes through blank automatically). Do **merge the status columns L–R** across the child's rows, since status is per child.

⚠️ **Never repeat the child's name on the second row** — the app reads it as a new child (duplicate serial, two invoices). Blank/merged = same child.

### The "Paid" rule (column M)

The app applies one blunt test:

> **Empty, or `no` / `n` / `false` / `0`** → not paid. **Anything else** → paid (ready for a receipt).

So `yes`, `PayNow`, `13/7/26` all mean paid. ⚠️ **The trap:** words like `pending`, `TBC`, `partial`, `chasing` also count as **paid** — the app only checks whether the cell is empty. Safe habit: **money not in → leave M empty; money in → type `yes` or the date.** Put chasing notes anywhere except M. A part payment is *not* paid — leave M empty until the full amount arrives.

### App vs Excel — who can have the file open

- **Reading:** the app can stay open all the time — it only reads. After any Excel edit, **Save (Ctrl+S)** then click **⟳ Refresh** in the app. (The app reads the *saved* file — unsaved Excel changes are invisible to it.)
- **Writing:** the app writes only when you **Generate a receipt** or **Mark as Sent**. If the file is open in Excel at that moment, the write is blocked and the app warns you — close Excel and click again. The PDF is still created.

### Other rules

- **Header row stays on row 1**; data from row 2.
- **Back up before big edits** (copy the file, add the date to the name).
- **Never delete/rename `Master` or move it off the front** — every term tab reads it by name.
- **Never insert, delete, or reorder a column** — the app finds each field by its position, so a shifted column breaks everything. Retype a wrong heading; don't move the column.
- Keep the file under **10 MB** (normal use is far below).

---

## 5. Common tasks

### Add a new student (30 seconds)
Master tab → next free row → Serial, Name, Parent, School, Level, Subject, Duration, Rate → Save. Two subjects? Add a second row, leave the name blank, merge A–E. They appear on every term tab automatically — go to the term and set their **Lessons (I)**.

### A student who joins or leaves mid-term
Master stays the full roster; each term's **Lessons (I)** decides who's billed and how much:
- **Joins mid-term** → put the lessons they'll actually attend (e.g. `6`). The bill pro-rates and the invoice prints "6 lessons". Use **Material Fee (J)** for any joining discount.
- **Not in this term** (added ahead for next term) → set **Lessons = 0** → they drop into "Not billed this term". Next term, blank (= 12) or the real number.
- **Leaves partway** → set Lessons to what they had; optionally set **Different End Date (P)** for the receipt.

Remember: **blank = 12, `0` = not billed, any number = that many.**

### Start a new term
Most terms already exist as blank tabs. To start one:
1. Pick it in the **Term sheet dropdown** (optionally drag its tab right after Master to make it the default).
2. Leave A–H alone; fill in **Lessons (I)** (+ Material Fee) for each child.
3. Update **Settings → Clause 2 Term Schedule** so invoices print the right dates.

Need a brand-new tab (e.g. `AY 27 T1`)? Right-click a term tab → **Move or Copy → Create a copy**, rename it (keep the `AY <yy> T<n>` shape), **clear columns I–R**, then follow the steps above.

### Close a finished term ("freeze" it)
A–H on a term tab are live links to Master, so a future rate change would rewrite an old term's fees. Freeze a term once it's fully done: select **A2:H500** → **Copy** → **Paste Special → Values** → Save. It looks identical but no longer changes with Master. Only freeze terms that are over.

---

## 6. Data protection (PDPA)

The spreadsheet and PDFs hold personal data of **minors** and their parents. Singapore's PDPA applies.
- Share the Drive folder **only** with the owner and current admins — never "anyone with the link".
- **Never email** the files or send them through personal chats — only the specific invoice/receipt to that child's own parent.
- No copies on personal devices or USB drives.
- When an admin leaves, the owner **removes their Drive access immediately** (see §7).
- Use the data only for billing.

---

## 7. Admin handover checklist

**Off-boarding:** remove their Google account from the folder's sharing list; have them uninstall the app and confirm no local copies of the spreadsheet/PDFs remain.

**Before handing over a spreadsheet used for testing:** clear columns **O** and **R** of any practice entries (leftover values make children look like they already have receipts). Leave column M (Paid) if you want the new admin to be able to try a receipt straight away.

**On-boarding:** share the folder (Editor); send a **link**, not files (installers are large and already sit in `App Installer`); have them follow §2 (flag the "Shared with me" step); walk them through one full cycle and the merged-cell rule.

---

## 8. Troubleshooting

| Problem | Cause & fix |
|---|---|
| Amber "Master spreadsheet not found" | Google Drive for desktop isn't running (start it, wait for sync), or the path in Settings → Folders is wrong for this computer. |
| Drive folder not in File Explorer / Finder | It's in **"Shared with me"** — add a shortcut to My Drive (§2, step 2). Most common setup issue. |
| Settings → Folders empty on a new install | Normal — every computer sets its own (§2, step 5). |
| "Windows protected your PC" / Mac "cannot verify" | Expected (unsigned). Run anyway / Open Anyway (§2, step 4). |
| **Cleared a receipt cell in Excel but the app still shows it issued/sent** | Status comes from **two** cells: **O (Receipt Issued)** and **R (Receipt Sent)**. To **un-send**, clear **R**; to **fully cancel** a receipt, clear **both O and R** (for a multi-subject child, clear the merged cell — i.e. all of the child's rows). Then **Save in Excel (Ctrl+S)** and click **⟳ Refresh** — edits aren't visible until the file is saved. The colour doesn't matter; the app reads the text, not the fill. |
| "Spreadsheet is open in Excel…" when generating / marking sent | The PDF was still made. Close the file in Excel and click again (it overwrites safely), or fill **column O/R** by hand. |
| A child shows twice / "serial already used" | The name was repeated on the second subject row — blank/merge it (§4). |
| Child not showing as ready for a receipt | Column M (Paid) is empty or says no/n. |
| Child shows "ready" but hasn't paid | Column M has a note like `pending`/`TBC` — the app counts any text as paid. Clear the cell (§4, Paid rule). |
| Shows "Generated"/"Sent" you never did on this computer | Expected — another admin did it and the spreadsheet remembers. |
| App shows outdated numbers | Save in Excel, then ⟳ Refresh (or reload the page). Check Drive has finished syncing. |
| Invoice missing a Material Fee line | It only prints when **column J** isn't zero. The note in **column K** never prints (internal). |
| Invoice Issued (L) didn't get stamped | The app only writes it when you **Export to Folder** from the invoice review screen — previewing or downloading a single PDF doesn't touch the sheet. If it still shows blank after exporting, the sheet was probably open in Excel at that moment (check the banner on the export screen); close Excel and export again. |
| A term tab shows a formula / `0` where a name should be | A–H are linked to Master — edit **Master**. A `0` means the link lost its blank-check; the cell should read `=IF(Master!B2="","",Master!B2)`. |
| A student added to Master isn't on the term tab | Confirm it's on **Master**, at or above **row 500**, and the file is **saved**. Below row 500? Copy a row down to extend the links. |
| An old term's fees changed by themselves | It was never frozen — freeze finished terms (§5). |
| App billing the wrong term | Pick the right one in the **Term sheet dropdown**. |
| A date shows as a number (`46216`) | Outdated app — install the current one. |

---

## 9. Technical reference (owner / maintainer)

Admins can ignore this section.

- **Installers:** GitHub Actions builds Win (NSIS `.exe`) + Mac (universal `.dmg`, unsigned) on every pushed tag (`git tag v0.x.y && git push origin v0.x.y`) and attaches them to one Release (~10–15 min). Keep `package.json` version in step with the tag. Stable links: `…/releases/latest/download/AccelLearn-Invoices-Setup.exe` and `…/AccelLearn-Invoices.dmg`. Local build: `npm run build && npm run dist` in `app/`.
- **Source:** repo `accellearn_invoice` (scoped to `app/`), Next.js 16 + Electron. Per-machine config: `%APPDATA%\app\data\template.json` (prefer the in-app Settings).
- **Workbook shape:** tab 1 `Master` (A–H, typed once); each following tab is a term pulling A–H via `=IF(Master!A2="","",Master!A2)` down to row 500. Deliberately not IFERROR (a blank isn't an error) and no spill formulas (they don't survive a script write + reopen). Nothing is locked.
- **Sheet selection & term picker:** defaults to the first non-Master tab (`activeTermSheet()`); the Import/Receipts dropdowns list `listTermSheets()` and pass the choice as `GET /api/students?sheet=<name>`. `parseWorkbook(buffer, requestedSheet?)` only honours a real non-Master tab (so Master is never billed). The response includes `sheetNames`.
- **Lessons / not-billed:** `numValOr(row, col, 12)` — blank → 12, typed `0` stays 0. The review page excludes `totalFee === 0 && totalLessons === 0` (`isBilledThisTerm`) into the "Not billed" panel.
- **Cached formula values:** the app reads Excel's *cached* results, so a script-written workbook must be opened + saved in Excel once (normal editing does this). `sheet-writeback.ts` resolves `{formula, result}` cells when matching serials.
- **Receipt status (spreadsheet-authoritative, two-way):** deterministic numbers `R-<TERMSLUG>-<serial×3>`. The receipts list reads status from columns O/R only (`receiptState(student)` with no ledger — `lib/receipt-status.ts`), so the sheet's blanks win; in-app actions optimistically `patchStudent` the row, then re-sync on reload. The local ledger (`receipts-ledger.json`, serials only, PDPA) is a last-resort fallback used only when the sheet is silent for a child (dup-confirm modal), and never revives a cleared status. Write-back (`withSheet`) targets `wb.getWorksheet(term)` = the selected tab, so edits land only on that term.
- **Scripts:** `scripts/add-term.js <workbook> "<tab>" …` clones a blank, correctly-styled term tab (A–H linked + cached, I–R blank, banding reset); `scripts/freeze-term.js <workbook> <tab>` converts A–H to values (`--dry-run` supported, refuses Master).
- The app runs entirely locally (localhost, random port); nothing leaves the computer except files written to the Drive folder.

---

## Version history

- **v0.11.0** — Column **D** relabelled **POC → School** (admin reference only, phone masking removed); **Adjustment (J/K) → Material Fee**, including the invoice PDF line item; **Invoice Issued (L)** is now stamped **"Yes"** automatically when invoices are exported to the shared folder (previously never written).
- **v0.10.1** — Internal bug-fix release (no admin-facing changes): config/ledger reads no longer crash on a UTF-8 BOM from hand-editing a JSON file in Notepad; fixed a broken local production build.
- **v0.10.0** — Receipt status syncs **both ways** with Excel (edit/clear O or R and the app follows on refresh); write-back only ever touches the selected term tab.
- **v0.9.0** — **Lessons = 0** marks a student "not billed this term" (skipped from the run); a typed `0` finally means zero (blank still = 12). Mid-term joiners handled by lesson count.
- **v0.8.0** — **Term sheet dropdown** on the Invoices and Receipts pages; the list updates as you add tabs.
- **v0.7.0** — Receipt **Preview** button; standard term tabs pre-created; "Adjustment Notes" label.
- **v0.6.0** — Receipt colour fills only its own cell; roster linked down to row 500.
- **v0.5.0** — Material Fee removed; status columns are L–R; the Receipt Issued cell is a red→green light.
- **v0.4.0** — **Master tab** + formula-linked term tabs (type each student once); freezing for closed terms.
