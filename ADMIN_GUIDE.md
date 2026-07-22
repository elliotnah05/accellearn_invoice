# AccelLearn Invoices & Receipts — Owner & Admin Guide

**App name:** AccelLearn Invoices (Windows & Mac desktop app)
**Last updated:** 22 July 2026 (v0.3.0 — new column layout)
**Who this is for:** The centre owner and any admin who runs billing. Keep this guide in the shared Google Drive folder and hand it to every new admin.

---

## 📌 Recent changes you should know about (v0.3.0)

- **⚠️ There is now ONE master file: `student details LATEST.xlsx`.** Every other copy has been retired. If you have an older `student details NEW.xlsx` anywhere, do not use it — its columns are in the old order and the app will read the wrong values out of it.
- **The two adjustment columns are now a single "Adjustment".** Material Adjustment and Lesson Adjustment (which used to be columns K–N) are merged into **column K — Adjustment ($)** plus **column L — Adjustment Notes**. Type a **minus** to reduce the bill (`-80`) or a plain number to add to it (`90`). Your totals have not changed: every student's Grand Total is exactly what it was before the merge.
- **Adjustment Notes are never printed.** Column L is your internal record only — it does not appear on the invoice or the receipt. The **amount** in column K does print, as a single "Adjustment" line under that subject.
- **Everything after column L shifted two letters left.** Because two columns disappeared, the status columns moved: Invoice Issued is now **M**, Paid is **N**, Date of Receipt **O**, Receipt Issued **P**, Different End Date **Q**, Backed Up **R**, Receipt Sent **S**. The sheet ends at **S** instead of U. See the full table in section 4.
- **New: `student details TEMPLATE.xlsx`.** A blank, correctly-formatted copy sitting next to the master. Start each new term from it instead of copying and pasting between sheets — see section 4a.
- **Receipt history now lives in the spreadsheet, not on one computer.** The app decides whether a receipt already exists by reading column **P** of the master file in the shared Drive folder. Previously it also relied on a record kept on the machine that issued it, which meant a *different* computer — a new admin, or the owner after handover — could re-issue a receipt without any warning. Now every computer sees the same history automatically, with nothing to copy across or set up. **What this means for you:** never clear columns P or S by hand (see Receipts, step 5).
- **Column N ("Paid") — read the warning in section 4.** Writing `pending`, `TBC`, or `partial` in that column makes the app treat the child as **fully paid**. Leave the cell completely empty until the money is actually in. (This column used to be P.)
- **The Import Sheet review table now has resizable columns.** Drag the right edge of any column header left or right to widen or narrow it — handy for reading a long adjustment note in full without opening the spreadsheet. Works just like resizing a column in Excel. Widths are just for your current viewing session and reset next time you load the sheet.

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
Download from google.com/drive/download and sign in. This is what makes the Drive folder appear as a **normal folder on your computer** — the app reads the spreadsheet as a file, so the folder must be visible in File Explorer (Windows) or Finder (Mac). Using Google Drive in a web browser is **not** enough.

⚠️ **The one step almost everyone misses.** If the folder was *shared with you* (rather than owned by you), it lands in **"Shared with me"**, which Drive for desktop does **not** put on your computer. You will not see it in File Explorer and the app will keep saying it can't find the spreadsheet.

**Fix it once:** open Google Drive in a browser → **Shared with me** → right-click `accellearn-invoice-reciept` → **Organise → Add shortcut to Drive** (older wording: *Add shortcut to My Drive*) → choose **My Drive** → Add. Within a minute it appears on your computer and stays there.
*If you are the owner of the folder, skip this — it is already in My Drive.*

**Then confirm where it landed:** typically `G:\My Drive\accellearn-invoice-reciept` on Windows — **the drive letter differs per computer** (G:, H:, …), so check yours. On Mac it's under `~/Library/CloudStorage/GoogleDrive-<your email>/My Drive/…`.
Fastest way to get the exact path: open the folder, then on Windows click the address bar and copy it; on Mac right-click the folder → *Get Info* → copy the location. Paste that straight into Settings in Step 4.

**Recommended:** right-click the folder → **Offline access → Available offline**. By default Drive only *streams* files (they live in the cloud until opened), which makes the app slow to read the spreadsheet and unable to work if the internet drops. Making it available offline keeps a real copy on the machine and syncs changes in the background.

**Step 3 — Install the app.**
Both installers are in the shared Drive folder under **`App Installer`** (with a READ ME file walking through these same steps):

- **Windows:** run **`AccelLearn-Invoices-Setup.exe`**. Windows shows a blue **"Windows protected your PC"** warning because the installer is unsigned — this is expected. Click **More info → Run anyway**, then Next → Install → Finish.
- **Mac:** open **`AccelLearn-Invoices.dmg`** and drag the app into Applications. The first launch is blocked ("Apple could not verify…") because the app isn't registered with Apple — go to **System Settings → Privacy & Security → Open Anyway** (older Macs: right-click the app → Open → Open). Needed once only.

**Step 4 — Point the app at the folder (one-time, per computer).**
Open the app → **Settings → Folders** and set:

- **Output folder:** the shared Drive folder, e.g. `G:\My Drive\accellearn-invoice-reciept`
- **Spreadsheet path:** the master file inside it, e.g. `G:\My Drive\accellearn-invoice-reciept\student details LATEST.xlsx`

Use **your** computer's drive letter (on a Mac the folder lives under `~/Library/CloudStorage/GoogleDrive-<your email>/My Drive/…` — easiest is to find it in Finder and copy the location). This setting is stored per computer, so every new machine needs this step once.

**Step 5 — Check it works.**
The home page should show a green **"Connected — N students from …"** banner. If it shows an amber error instead, see Troubleshooting (section 7).

---

## 3. How the app works day-to-day

**The home page** has an **Invoices | Receipts** toggle for the two workflows, with **Status** and **Settings** links top-right. Below the header is a data-source banner: green **"Connected — N students from …"** means the app can see the master spreadsheet; amber means it can't (see Troubleshooting).

### Invoices

1. **Import Sheet** — click *Load Master Sheet* to pull the live spreadsheet (you can also drag-drop an Excel file, but normally you never need to). The table is editable: rate, duration, lessons, fees, adjustments. Edited rows turn yellow and totals recalculate live. ⚠️ **Edits you make in this table do NOT change the master spreadsheet.** They only affect the PDFs being generated right now — nothing is written back to Excel. If a change should be permanent (e.g. a new tuition timing/duration or rate), edit the **spreadsheet** itself, not just the app table. Drag a column header's right edge to widen/narrow it if you need to read a long note in full.
2. **Generate Invoices** — creates a PDF per child. A child with multiple subjects gets **one** invoice with a line item per subject.
3. **Review & Approve** — each row has *Preview* (opens the PDF in a pop-up so you can check it before it goes anywhere), then Approve ✓ or Flag ⚠ (a flagged row expands so you can type a note about what's wrong). *Approve All Pending* for bulk. The bar at the bottom keeps a live count of approved / flagged / pending and the total dollar amount.
4. **Export** — approved invoices are written to the shared folder under **`Invoices\<term>\`** (e.g. `Invoices\AY 26 T3\`). Use the *Open folder* button, then send each PDF to the parent yourself.

### Receipts

1. A child appears as **ready for a receipt** once their **Paid** column in the spreadsheet is filled in (see section 4).
2. **Generate** writes the PDF to **`Receipts\<term>\`** and automatically writes back into the spreadsheet: column **P** (Receipt Issued) gets the receipt number and date.
3. **Mark as Sent** after you've sent it to the parent — ✅ **this DOES edit the master spreadsheet for you**, writing column **S** (Receipt Sent), e.g. `Sent 19/07/26`. (Generating the receipt in step 2 likewise writes column P.) You don't have to fill these in by hand — unless the spreadsheet was open in Excel at the time, in which case the app can't write and warns you.
4. Receipt numbers are automatic and fixed: `R-AY26T3-013` = term AY 26 T3, serial 13. **Re-generating the same receipt can never create a second conflicting number** — the app warns you it's a duplicate and, if you proceed, overwrites the same file.
5. **The spreadsheet is what remembers.** The app knows a receipt already exists because column **R** is filled in — not because of anything stored on your computer. That means the duplicate warning works **on any computer, for any admin**: a brand-new install reads the same shared spreadsheet and immediately knows the full history. Nothing is lost when an admin changes machines or hands over.
   ⚠️ The flip side: **do not clear or overwrite columns P and S by hand.** Wiping them tells the app the receipt never happened, and it will silently issue a second one. If a receipt genuinely needs re-doing, use the *Re-generate* button — it keeps the same number and replaces the same file.

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

**The file:** `student details LATEST.xlsx` in the shared Drive folder. This is the **only** master — if you find an older `student details LATEST.xlsx` anywhere, it is retired and must not be used. The **sheet (tab) name is the term** — e.g. `AY 26 T3` — and it becomes the PDF folder name, so name it sensibly.

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
| K | Adjustment ($) | `-80` or `90` | **One figure, plus or minus.** Minus reduces the bill (missed lessons, discount, shorter lessons); a plain number adds to it (extra session, assessment book). Prints on the invoice as a single "Adjustment" line for that subject. Leave blank or `0` if none |
| L | Adjustment Notes | `2 lessons missed, not replaced` | **Your own reference only — never printed on the invoice or receipt.** Write whatever helps you remember why column K is what it is |
| M | Invoice Issued | `1/7/26` (or `yes`) | Admin fills manually — your own tracking |
| N | Paid | `yes`, `PayNow`, or `13/7/26` | Anything except no/n — see "Paid rule" below |
| O | Date of Receipt | `13/7/26` | **Date the payment arrived — this exact date prints on the receipt** ("received a payment … on 13/07/26") |
| P | Receipt Issued | *leave alone* | **App writes this**: `R-AY26T3-015 · 14/07/26` |
| Q | Different End Date | `2/8/26` (usually empty) | Only if a child ends the term early/late — **prints as that child's term end date on the receipt** |
| R | Backed Up | `yes` / `✓` | Admin's own tracking, not used by the app |
| S | Receipt Sent | *leave alone* | **App writes this** when you click Mark as Sent: `Sent 14/07/26` |

### How a bill is worked out

For **each subject row**:

```
Lesson Fee = Rate/hr (H) × Duration (G) × Lessons (I)
Subtotal   = Lesson Fee + Material Fee (J) + Adjustment (K)
```

Then:

```
Grand Total = the subtotals of all of the child's subject rows added together
```

The Adjustment is added, so a **negative** number subtracts. Worked example — a child taking two subjects:

| | Maths | Science |
|---|---|---|
| Rate × Duration × Lessons | $40 × 2 × 12 = **$960** | $40 × 1.5 × 12 = **$720** |
| Material Fee (J) | $30 | $25 |
| Adjustment (K) | **+$45** (assessment book) | **−$75** (2hr → 1.5hr from Wk 5) |
| **Subtotal** | **$1,035** | **$670** |

**Grand Total = $1,035 + $670 = $1,705.** The invoice shows six lines (Lesson Fee, Material Fee and Adjustment for each subject); the two notes in column L appear nowhere on it. A negative adjustment prints in brackets, accounting-style: `($75.00)`.

### Dates — how to type them

- Just type dates naturally, e.g. **`13/7/26`**, and press Enter — Excel converts it into a proper date cell and the app reads it correctly, showing it as `13/07/26`. Typing it as plain text also works.
- Keep to **day/month/year** order (Singapore style). Avoid ambiguous or American formats like `7/13/26`.
- The two dates parents actually see are **O (Date of Receipt)** and **Q (Different End Date)** — both print word-for-word on the receipt, so double-check those two.
- If a date ever shows up as a plain number like `46216` in the app or on a PDF, you're running an outdated version of the app — install the current installer from the Drive folder.

### Children with more than one subject — the merged-cell rule

One row = one subject. A child taking two subjects takes **two rows**, grouped like this:

- Put the child's details (columns A–E) on the **first** row only.
- **Merge** columns A–E and M–S vertically across the child's rows (select the cells → Merge & Center). At minimum, leave Student Name (B) **blank** on the extra rows — a blank/merged name cell is how the app knows "this row is another subject for the child above".
- Each row keeps its own subject columns F–L.

⚠️ **Never repeat the child's name on the second row.** The app will treat it as a duplicate child, warn about the reused serial, and could produce two invoices. Blank or merged = same child; name filled in = new child.

### The "Paid" rule (column N)

The app does **not** understand what you write in column N. It applies one blunt rule:

> **Empty, or `no` / `n` / `false` / `0`** → not paid.
> **Literally anything else** → paid, and the child becomes ready for a receipt.

So `yes`, `Y`, `PayNow`, `13/7/26`, `bank transfer` all correctly mean paid.

⚠️ **The trap: words that mean "not paid yet" still count as PAID.** If you type **`pending`**, **`TBC`**, **`partial`**, **`half`**, **`chasing`**, **`waiting`**, or a reminder note like `asked mum 12/7` into column N, the app reads all of those as **paid** and will happily offer to issue a receipt for money you have not received. It is not being clever — it only checks whether the cell is empty.

**The safe habit:** column N has exactly two states.

- Money **not** in → leave the cell **completely empty**. Nothing else.
- Money **in** → type `yes` (or the payment date).

If you need to record chasing notes, part payments, or "parent says they'll pay Friday", put them in **any other column or a comment** — never in column N. A part payment is **not** paid: leave P empty until the full amount arrives, or you will issue a receipt for the full term fee against a partial payment.

*(Why it works this way: different admins write "paid" a dozen different ways, so the app accepts all of them rather than forcing one spelling. The cost of that flexibility is that it can't tell a real payment from a note.)*

### Other rules

- **Close the spreadsheet before generating receipts.** If the file is open in Excel, the receipt PDF still generates but the app can't write columns P/S — it will warn you, and you must fill in the cell by hand (or close Excel and re-generate).
- **Header row stays on row 1.** Data starts from row 2.
- **Make a backup copy before big edits** (e.g. setting up a new term). Just copy the file in Drive and add the date to the name.
- **New term = new file or new tab** named after the term (e.g. `AY 26 T4`), same column layout. Start it from the template — see section 4a. Then update Settings → Folders if the file name changed, and update the term schedule in Settings.
- The file must stay under **10 MB** (it will be nowhere near this in normal use).

---

## 4a. Starting a new term — use the template file

Sitting next to the master is **`student details TEMPLATE.xlsx`**: an empty sheet with the correct headers, colours, column widths and frozen header row, and **nothing else**. It exists so that setting up a term never involves copying and pasting blocks of cells between spreadsheets — which is how columns end up shifted by one and every invoice comes out wrong.

**To start a new term:**

1. In Drive, right-click `student details TEMPLATE.xlsx` → **Make a copy**. Rename the copy to the new term, e.g. `student details LATEST AY 26 T4.xlsx` — or add a new tab to the existing master and paste the template's header row into it.
2. Rename the **tab** to the term (e.g. `AY 26 T4`). The template ships with its tab called `NEW TERM (rename this tab)` precisely so a forgotten rename is impossible to miss — the tab name becomes the PDF folder name.
3. Fill in **columns A–H** for each child — Serial No, Student Name, Parent Name, POC, Level, Subject, Duration, Rate. **These eight columns never change between terms**, so you can safely copy them down from last term's sheet in one block.
4. Fill in **I (Lessons)**, **J (Material Fee)** and, where needed, **K/L (Adjustment and its note)** for the new term.
5. Leave **M–S** (the status columns) completely empty. The app fills P and S in for you; M, N, O, Q and R are yours to fill as the term runs.
6. Point the app at the new file: **Settings → Folders → Spreadsheet path**.

⚠️ **Never insert, delete or reorder a column**, in the template or the master. The app finds every field by its column position, not by its heading — a single inserted column silently shifts everything after it and the app will read material fees as lesson counts. If a column heading looks wrong, retype the heading; don't move the column.

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

**Before handing over a spreadsheet that was used for testing**
Clear columns **P** (Receipt Issued) and **S** (Receipt Sent) of any practice entries first. The app treats those columns as the real record, so leftover test values make children look like they already have receipts — and trigger a false "already exists" warning when the genuine one is issued. Leave column N (Paid) alone if you want the new admin to be able to try generating a receipt straight away.

**On-boarding the new admin**
1. Share the Drive folder `accellearn-invoice-reciept` with their Google account (Editor).
2. Send them a **link**, not files — the installers are large (155 MB Windows, 271 MB Mac) and both already sit in the Drive folder under `App Installer`, alongside this guide. Once they have Drive access there is nothing to send at all. (Chat apps also tend to flag or block `.exe` attachments.)
3. They follow **Section 2** (setup) on their computer — flag Step 2's "Shared with me" shortcut, which is where most people get stuck.
4. Walk them through one full cycle: generate one invoice → export → generate one receipt → Mark as Sent, and show them the merged-cell rule in the spreadsheet (Section 4).

---

## 7. Troubleshooting

| Problem | Cause & fix |
|---|---|
| Amber banner: "Master spreadsheet not found — check Settings → Folders" | Google Drive for desktop isn't running yet (start it, wait for sync, reopen the app), or the drive letter / path in Settings → Folders is wrong for this computer. |
| The Drive folder is nowhere in File Explorer / Finder | It's sitting in **"Shared with me"**, which doesn't sync to your computer. Add a shortcut to My Drive — see Section 2, Step 2. This is the most common setup problem. |
| Settings → Folders is empty on a new install | Normal. Every computer picks its own folders — fill both in from Section 2, Step 4. |
| Folder paths look right but point at someone else's computer | You're on an old version that shipped the builder's paths. Clear both boxes in Settings → Folders and enter your own. |
| Blue "Windows protected your PC" when installing | Expected (unsigned installer). More info → Run anyway. |
| Mac blocks the app: "Apple could not verify…" | Expected (app not registered with Apple). System Settings → Privacy & Security → **Open Anyway** (older Macs: right-click the app → Open). Once only. |
| Warning: "Spreadsheet is open in Excel…" when generating a receipt | The receipt PDF was still created. Close the file in Excel and re-generate (it overwrites safely), or type the receipt number into column P yourself. |
| A child shows up twice / "serial already used" warning | The child's name was repeated on their second subject row. Blank/merge the name cell on the extra rows (Section 4). |
| Child not appearing as ready for receipt | Column N (Paid) is empty, or contains "no"/"n". |
| A child shows as "ready for receipt" but hasn't actually paid | Column N contains a note like `pending`, `TBC`, `partial` or `chasing` — the app counts **any** text as paid. Clear the cell completely (section 4, "Paid rule"). |
| Child shows "Generated"/"Sent" but you never issued it on this computer | Correct and expected — another admin issued it and the spreadsheet remembers. Nothing to fix. |
| No duplicate warning when you expected one | Column R was cleared or overwritten by hand. That column is how the app remembers — restore it, or use *Re-generate* rather than deleting. |
| App shows outdated numbers | The pages read live on load; use the ⟳ Refresh button on the Receipts page, or reload the page. Also check Drive has finished syncing (tick icon). |
| Duplicate receipt warning | You already issued this receipt. Proceeding re-issues with the **same** number and overwrites the same PDF — safe if you meant to re-issue. |
| Invoice PDF missing an Adjustment line | The Adjustment line only prints when the amount in column K is not zero. A note in column L never prints on its own — column L is internal (see "Recent changes" above). |
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
- **Receipt history:** the master spreadsheet is the source of truth — column **P** (Receipt Issued) and column **S** (Receipt Sent), written automatically on generate / Mark as Sent and parsed back on load. Receipt numbers are deterministic (`R-<TERMSLUG>-<serial padded to 3>`), so nothing needs to be looked up or carried between machines. A local **ledger** (`receipts-ledger.json`, alongside the config; serial numbers only, no names, by PDPA design) is kept as a **secondary cache** — it only matters when the spreadsheet was open in Excel and the write-back failed, in which case it is the only record of the issuance. Status is the union of the two sources, so a missing or wiped ledger degrades gracefully instead of causing silent duplicate receipts.
- The app runs entirely on the local machine (localhost, random port); no data leaves the computer except files written to the Drive folder.
