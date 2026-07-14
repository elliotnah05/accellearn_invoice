# AccelLearn Invoices & Receipts — Owner & Admin Guide

**App name:** AccelLearn Invoices (Windows & Mac desktop app)
**Last updated:** 14 July 2026
**Who this is for:** The centre owner and any admin who runs billing. Keep this guide in the shared Google Drive folder and hand it to every new admin.

---

## 1. What this app does

The app mass-generates **invoice PDFs** and **receipt PDFs** for all students, straight into the shared Google Drive folder. It reads the master Excel spreadsheet **live** — you edit the spreadsheet in Excel as usual, and the app always shows the latest data. Nothing is "uploaded" or "synced" manually.

**The admin sends every PDF to parents themselves** (e.g. via WhatsApp) — the app only creates the files and tracks what has been issued and sent.

The flow in one line:

> Edit spreadsheet → app generates PDFs into Drive → admin sends PDFs to parents → admin marks Paid in the spreadsheet → app generates receipts → admin sends receipts.

---

## 2. First-time setup (new computer or new admin)

**Step 1 — Get access to the shared folder.**
The owner must share the Google Drive folder **`accellearn-invoice-reciept`** with your Google account. This folder contains the master spreadsheet, all generated PDFs, and this guide.

**Step 2 — Install Google Drive for desktop.**
Download from google.com/drive/download, sign in, and make sure the shared folder appears in File Explorer (usually under a drive letter like `G:\My Drive\accellearn-invoice-reciept` — **the letter can differ per computer**, note down yours).
Recommended: right-click the folder → *Offline access* → *Available offline*, so the app still works if the internet drops.

**Step 3 — Install the app.**
Both installers are in the shared Drive folder under **`App Installer`** (with a READ ME file walking through these same steps):

- **Windows:** run **`AccelLearn-Invoices-Setup.exe`**. Windows shows a blue **"Windows protected your PC"** warning because the installer is unsigned — this is expected. Click **More info → Run anyway**, then Next → Install → Finish.
- **Mac:** open **`AccelLearn-Invoices.dmg`** and drag the app into Applications. The first launch is blocked ("Apple could not verify…") because the app isn't registered with Apple — go to **System Settings → Privacy & Security → Open Anyway** (older Macs: right-click the app → Open → Open). Needed once only.

**Step 4 — Point the app at the folder (one-time, per computer).**
Open the app → **Settings → Folders** and set:

- **Output folder:** the shared Drive folder, e.g. `G:\My Drive\accellearn-invoice-reciept`
- **Spreadsheet path:** the master file inside it, e.g. `G:\My Drive\accellearn-invoice-reciept\student details NEW.xlsx`

Use **your** computer's drive letter (on a Mac the folder lives under `~/Library/CloudStorage/GoogleDrive-<your email>/My Drive/…` — easiest is to find it in Finder and copy the location). This setting is stored per computer, so every new machine needs this step once.

**Step 5 — Check it works.**
The home page should show a green **"Connected — N students from …"** banner. If it shows an amber error instead, see Troubleshooting (section 7).

---

## 3. How the app works day-to-day

**The home page** has an **Invoices | Receipts** toggle for the two workflows, with **Status** and **Settings** links top-right. Below the header is a data-source banner: green **"Connected — N students from …"** means the app can see the master spreadsheet; amber means it can't (see Troubleshooting).

### Invoices

1. **Import Sheet** — click *Load Master Sheet* to pull the live spreadsheet (you can also drag-drop an Excel file, but normally you never need to). The table is editable: rate, duration, lessons, fees, adjustments. Edited rows turn yellow and totals recalculate live. *Edits here only affect the PDFs being generated — they are NOT written back to the spreadsheet.*
2. **Generate Invoices** — creates a PDF per child. A child with multiple subjects gets **one** invoice with a line item per subject.
3. **Review & Approve** — each row has *Preview* (opens the PDF in a pop-up so you can check it before it goes anywhere), then Approve ✓ or Flag ⚠ (a flagged row expands so you can type a note about what's wrong). *Approve All Pending* for bulk. The bar at the bottom keeps a live count of approved / flagged / pending and the total dollar amount.
4. **Export** — approved invoices are written to the shared folder under **`Invoices\<term>\`** (e.g. `Invoices\AY 26 T3\`). Use the *Open folder* button, then send each PDF to the parent yourself.

### Receipts

1. A child appears as **ready for a receipt** once their **Paid** column in the spreadsheet is filled in (see section 4).
2. **Generate** writes the PDF to **`Receipts\<term>\`** and automatically writes back into the spreadsheet: column **R** (Receipt Issued) gets the receipt number and date.
3. **Mark as Sent** after you've sent it to the parent — this writes column **U** (Receipt Sent) in the spreadsheet.
4. Receipt numbers are automatic and fixed: `R-AY26T3-013` = term AY 26 T3, serial 13. **Re-generating the same receipt can never create a second conflicting number** — the app warns you it's a duplicate and, if you proceed, overwrites the same file.

### Status

An overview of every child: invoiced / paid / receipt issued / receipt sent, with count tiles. Use it to see at a glance who still owes or who hasn't gotten a receipt.

### Settings — editing the invoice template

Everything on the invoice that isn't per-student lives here, editable without any technical help. Changes apply to the **next** PDF you generate — no restart needed. The page is organised into cards:

- **Folders** — the two paths from Section 2 (output folder + master spreadsheet file). Set once per computer; only touch again if the Drive letter changes.
- **Company Details** — Company Name and PayNow UEN, shown in the PayNow clause of every invoice. ⚠️ The company name must be the **registered business name** the UEN belongs to.
- **Clause 1 — Term Structure** — the opening T&C paragraph (4 terms a year, 12 lessons each, public-holiday policy). Plain text, edit freely.
- **Clause 2 — Term Schedule** — the table of terms and holiday weeks printed on every invoice, one row per entry (e.g. label `Term 3`, period `4/5/26 to 2/8/26`). Use ↑ ↓ to reorder, ✕ to remove, and the add button for new rows. **Update this at the start of each academic year.** Note: the receipt's "term ending on" date is taken from the matching term row's period here — so keep the "… to <date>" part accurate.
- **Clause 3 — Fee Schedule** — an intro line plus one line per fee item (add / reorder / remove, same buttons).
- **Clause 4 — Makeup Policy** — plain-text clause, edit freely.

Remember to click **Save Changes** when done — a green "✓ Changes have been saved" confirmation appears. A test tip: after any template change, generate one invoice and Preview it before doing a mass run.

---

## 4. The master spreadsheet — rules that keep everything working

This is the most important section. The spreadsheet is the **single source of truth** — the app reads it live and writes receipt status back into it.

**The file:** `student details NEW.xlsx` in the shared Drive folder. The **sheet (tab) name is the term** — e.g. `AY 26 T3` — and it becomes the PDF folder name, so name it sensibly.

### Column layout (do not rename, reorder, insert, or delete columns)

| Col | Field | What to type — with example | Notes |
|-----|-------|------------------------------|-------|
| A | Serial No | A whole number: `15` | **Unique number per child.** Never reuse one. |
| B | Student Name | `Jayden Tan` | Child's **first** row only (see merged-cell rule below) |
| C | Parent Name | `Mrs Tan` | Printed on invoice & receipt |
| D | POC (WhatsApp) | `91234567` | Parent's contact number |
| E | Level | `Sec 3` | e.g. `P5`, `Sec 3`, `JC1` — printed as the child's level |
| F | Subject | `Mathematics` | One subject per row |
| G | Duration (hrs) | `2` | Hours per lesson (blank = 2) |
| H | Rate/hr ($) | `55` | Number only, no $ sign. **Required** — the app flags rows missing this |
| I | Lessons | `12` | Number of lessons in the term (blank = 12) |
| J | Material Fee ($) | `30` | Number only; leave blank or `0` if none |
| K | Material Adjustment ($) | `-10` | Use a **minus for discounts**; can be `0` with a note — the note still prints |
| L | Material Adj Notes | `sibling discount` | Prints on the invoice next to the material line |
| M | Lesson Adjustment ($) | `-55` | e.g. lesson missed last term, discount; minus = reduce |
| N | Lesson Adj Notes | `1 make-up lesson carried over` | Prints on the invoice next to the lesson line |
| O | Invoice Issued | `1/7/26` (or `yes`) | Admin fills manually — your own tracking |
| P | Paid | `yes`, `PayNow`, or `13/7/26` | Anything except no/n — see "Paid rule" below |
| Q | Date of Receipt | `13/7/26` | **Date the payment arrived — this exact date prints on the receipt** ("received a payment … on 13/07/26") |
| R | Receipt Issued | *leave alone* | **App writes this**: `R-AY26T3-015 · 14/07/26` |
| S | Different End Date | `2/8/26` (usually empty) | Only if a child ends the term early/late — **prints as that child's term end date on the receipt** |
| T | Backed Up | `yes` / `✓` | Admin's own tracking, not used by the app |
| U | Receipt Sent | *leave alone* | **App writes this** when you click Mark as Sent: `Sent 14/07/26` |

Lesson fee is calculated as **Rate × Duration × Lessons**; the child's total = lesson fees + material fees + all adjustments.

### Dates — how to type them

- Just type dates naturally, e.g. **`13/7/26`**, and press Enter — Excel converts it into a proper date cell and the app reads it correctly, showing it as `13/07/26`. Typing it as plain text also works.
- Keep to **day/month/year** order (Singapore style). Avoid ambiguous or American formats like `7/13/26`.
- The two dates parents actually see are **Q (Date of Receipt)** and **S (Different End Date)** — both print word-for-word on the receipt, so double-check those two.
- If a date ever shows up as a plain number like `46216` in the app or on a PDF, you're running an outdated version of the app — install the current installer from the Drive folder.

### Children with more than one subject — the merged-cell rule

One row = one subject. A child taking two subjects takes **two rows**, grouped like this:

- Put the child's details (columns A–E) on the **first** row only.
- **Merge** columns A–E and O–U vertically across the child's rows (select the cells → Merge & Center). At minimum, leave Student Name (B) **blank** on the extra rows — a blank/merged name cell is how the app knows "this row is another subject for the child above".
- Each row keeps its own subject columns F–N.

⚠️ **Never repeat the child's name on the second row.** The app will treat it as a duplicate child, warn about the reused serial, and could produce two invoices. Blank or merged = same child; name filled in = new child.

### The "Paid" rule (column P)

Any non-empty value counts as paid — `yes`, `Y`, `PayNow`, a date, anything — **except** `no`, `n`, `false`, or `0`. Leave it empty until money is received. Once filled, the child shows up as ready for a receipt.

### Other rules

- **Close the spreadsheet before generating receipts.** If the file is open in Excel, the receipt PDF still generates but the app can't write columns R/U — it will warn you, and you must fill in the cell by hand (or close Excel and re-generate).
- **Header row stays on row 1.** Data starts from row 2.
- **Make a backup copy before big edits** (e.g. setting up a new term). Just copy the file in Drive and add the date to the name.
- **New term = new file or new tab** named after the term (e.g. `AY 26 T4`), same column layout. Then update Settings → Folders if the file name changed, and update the term schedule in Settings.
- The file must stay under **10 MB** (it will be nowhere near this in normal use).

---

## 5. Data protection (PDPA) — non-negotiable

The spreadsheet and PDFs contain personal data of **minors** plus parents' contact numbers and fee amounts. Singapore's PDPA applies.

- The shared Drive folder must be shared **only with the owner and current admins**. Never share it "anyone with the link".
- **Never email** the spreadsheet or PDFs, or send them through personal chats other than the intended invoice/receipt to that child's own parent.
- Don't keep copies on personal devices or USB drives.
- When an admin **leaves**, the owner must immediately remove their access to the Drive folder (Drive → Share → remove) — see the handover checklist below.
- Use the data only for billing. No other use without the owner's say-so.

---

## 6. Admin handover checklist

When an admin changes, the owner does this:

**Off-boarding the old admin**
1. Remove their Google account from the Drive folder's sharing list.
2. Ask them to uninstall the app (Windows: Settings → Apps → AccelLearn Invoices; Mac: drag the app from Applications to Trash) and confirm no copies of the spreadsheet/PDFs remain on their machine (check their Drive for desktop is signed out or the offline copy removed).

**On-boarding the new admin**
1. Share the Drive folder `accellearn-invoice-reciept` with their Google account (Editor).
2. Send them this guide and the installer.
3. They follow **Section 2** (setup) on their computer.
4. Walk them through one full cycle: generate one invoice → export → generate one receipt → Mark as Sent, and show them the merged-cell rule in the spreadsheet (Section 4).

---

## 7. Troubleshooting

| Problem | Cause & fix |
|---|---|
| Amber banner: "Master spreadsheet not found — check Settings → Folders" | Google Drive for desktop isn't running yet (start it, wait for sync, reopen the app), or the drive letter / path in Settings → Folders is wrong for this computer. |
| Blue "Windows protected your PC" when installing | Expected (unsigned installer). More info → Run anyway. |
| Mac blocks the app: "Apple could not verify…" | Expected (app not registered with Apple). System Settings → Privacy & Security → **Open Anyway** (older Macs: right-click the app → Open). Once only. |
| Warning: "Spreadsheet is open in Excel…" when generating a receipt | The receipt PDF was still created. Close the file in Excel and re-generate (it overwrites safely), or type the receipt number into column R yourself. |
| A child shows up twice / "serial already used" warning | The child's name was repeated on their second subject row. Blank/merge the name cell on the extra rows (Section 4). |
| Child not appearing as ready for receipt | Column P (Paid) is empty, or contains "no"/"n". |
| App shows outdated numbers | The pages read live on load; use the ⟳ Refresh button on the Receipts page, or reload the page. Also check Drive has finished syncing (tick icon). |
| Duplicate receipt warning | You already issued this receipt. Proceeding re-issues with the **same** number and overwrites the same PDF — safe if you meant to re-issue. |
| Invoice PDF missing an adjustment | Adjustment notes print even when the amount is $0 — check the note is in column L or N of the right row. |
| A date shows as a number like `46216` in the app or on a receipt | You're running an outdated version of the app — install the current installer from the Drive folder. Current versions read Excel dates correctly. |

---

## 8. Technical reference (for the owner / maintainer)

Admins can ignore this section.

- **Installers:** built automatically by GitHub Actions whenever a version tag is pushed (`git tag v0.x.y && git push origin v0.x.y`) — a Windows machine and a Mac machine build `AccelLearn-Invoices-Setup.exe` (NSIS) and `AccelLearn-Invoices.dmg` (universal Intel + Apple Silicon), both unsigned, and attach them to one GitHub Release (~10–15 min). Keep package.json `version` in step with the tag.
- **Stable download links** (always the newest release):
  `https://github.com/elliotnah05/accellearn_invoice/releases/latest/download/AccelLearn-Invoices-Setup.exe`
  `https://github.com/elliotnah05/accellearn_invoice/releases/latest/download/AccelLearn-Invoices.dmg`
  Every past version stays archived under Releases, so you can roll back by downloading an older one. Local one-off builds still work: `npm run build` then `npm run dist` inside `app/`.
- **Source code:** the `INVOICE ACCELLEARN` project folder (repo `accellearn_invoice`, scoped to `app/`). Next.js 16 + Electron.
- **Per-machine app config** (folder paths, invoice template): `%APPDATA%\app\data\template.json` — but always prefer editing via the in-app Settings pages.
- **Receipt ledger** (issue/re-issue/sent history, serial numbers only — no names, by PDPA design): stored alongside the config in the same data folder.
- The app runs entirely on the local machine (localhost, random port); no data leaves the computer except files written to the Drive folder.
