# AccelLearn Invoices & Receipts — Owner & Admin Guide

**App name:** AccelLearn Invoices (Windows & Mac desktop app)
**Last updated:** 24 July 2026 (v0.10.0 — receipt status syncs both ways with Excel)
**Who this is for:** The centre owner and any admin who runs billing. Keep this guide in the shared Google Drive folder and hand it to every new admin.

---

## 📌 Recent changes you should know about (v0.10.0)

- **Receipt status now syncs *both ways* with Excel.** The app already wrote to the spreadsheet when you clicked Generate / Mark as Sent. Now it also *reads* those cells as the truth: **edit column O (Receipt Issued) or R (Receipt Sent) in Excel and the app reflects it on the next ⟳ Refresh.** Delete a wrong `Sent` mark in Excel and the row drops back to *Generated* (its Mark as Sent button returns); clear both O and R and the row goes back to *Ready*. The spreadsheet wins — its blanks are respected, and a stale entry on one computer can no longer revive a status you removed.
- **Edits always land on the term you've selected.** Generate / Mark as Sent write **only** to the tab chosen in the Term sheet dropdown (verified) — never to another term.

---

## 📌 Earlier changes (v0.9.0)

- **Students not enrolled in a term are skipped from that term's invoices.** Set a student's **Lessons to `0`** on a term tab and the app now treats them as *not billed this term* — they don't appear in the invoice run, aren't counted, and never produce a $0 invoice. They're listed in a small grey **"Not billed this term"** panel under the review table so you can still see them. This is exactly how you handle someone who's on Master for a **future** term but isn't in the current one.
- **`0` lessons finally means zero.** Previously a blank Lessons cell *and* a typed `0` both became 12 — so you couldn't actually zero someone out. Now: **blank = the standard 12**, but **`0` = zero lessons = not billed**. (Any other number bills that many lessons, e.g. `6` for a mid-term joiner.)
- **Mid-term joiner, in one line:** add them to Master once, put the number of lessons they'll actually attend this term in the term tab (e.g. `6`), and leave next term at the full 12. See section 4a, "A student who joins or leaves mid-term".

---

## 📌 Earlier changes (v0.8.0)

- **You can now choose which term tab to work on — right in the app.** Both the **Import (Invoices)** page and the **Receipts** page now have a **Term sheet dropdown** listing every term tab in the workbook (everything except Master). Pick `AY 26 T2`, `AY 26 T3`, `AY 26 T4`, … and the app instantly loads that term's students, fees and receipt statuses.
- **The list updates itself.** Add a new term tab in Excel (or with the maintainer script), click ⟳ Refresh / reload, and it appears in the dropdown automatically — nothing to configure.
- **You no longer *have* to drag the current term to the front.** Dragging a tab to sit right after Master still sets the **default** term the app opens on, but the dropdown lets you bill or receipt **any** term without rearranging tabs. (Master is never listed — it holds no fees.)

---

## 📌 Earlier changes (v0.7.0)

- **You can now preview a receipt before issuing it.** The Receipts page has a **Preview** button on every row — it opens the exact PDF the parent would get in a pop-up (with a Download button), just like the invoice preview. **Previewing changes nothing:** no file is saved, no receipt number is used up, and the spreadsheet is not touched. Only *Generate Receipt* commits anything. Use it to eye-check the amount and dates first.
- **All four term tabs already exist in the workbook.** `student details LATEST.xlsx` now ships with **`AY 26 T2`, `AY 26 T3` and `AY 26 T4`** tabs. `T2` and `T4` are **blank and ready** — their A–H columns already link to Master; you just fill in Lessons/Adjustments/status when that term comes around. Starting one of those terms no longer means copying a tab — see section 4a.
- **Small wording fix.** The editable import table's column now reads **"Adjustment Notes"** in full (was "Adj Notes"). Same column, clearer label — nothing else changed.

---

## 📌 Earlier changes (v0.6.0)

- **The sent/receipt colour now fills just the one cell.** Marking a receipt sent colours **only** the Receipt Issued cell (green), not the whole row as before. Generating colours only that cell red.
- **Room for more students.** The linked rows now run to **row 500** (were 201), so you can keep adding people to Master for years without extending anything.
- **The app and Excel no longer get in each other's way** — see the new note in section 4, "Do the app and Excel fight over the file?".

---

## 📌 Earlier changes (v0.5.0)

- **The Material Fee column is gone.** Fees are now just the lesson fee plus any adjustment. Every child's total dropped by whatever material fee they used to have (e.g. a child who was $870 with a $30 material fee is now $840). The "Material Cost" line was also removed from the invoice's fee schedule.
- **The columns after Lessons shifted one letter left** (because Material used to sit between them). The status columns are now **L–R**: Invoice Issued **L**, Paid **M**, Date of Receipt **N**, Receipt Issued **O**, Different End Date **P**, Backed Up **Q**, Receipt Sent **R**. Full table in section 4.
- **A–H on the term tabs are no longer locked.** You can still just edit the Master tab as before and everything flows through — but nothing is protected anymore, so if you ever need to you *can* type directly on a term tab. (If you accidentally type over a linked cell, press Undo to bring the formula back.)
- **The Receipt Issued cell is a colour light.** When you generate a receipt it fills that one cell **red** (issued, not yet sent); when you press **Mark as Sent** it turns **green**. One glance down the column shows what still needs sending.
- **Negative adjustments print with a minus sign** on the invoice — a −$40 discount now shows as `-$40.00` instead of `($40.00)`.

---

## 📌 Earlier changes (v0.4.0)

- **⭐ You never have to retype or copy-paste student details again.** The workbook now has a **`Master`** tab holding columns **A–H** — Serial No, Student Name, Parent Name, POC, Level, Subject, Duration and Rate. That is the one and only place a student is ever typed in.
- **Every term tab reads A–H from Master automatically.** Add a new child to Master once and they appear on the current term — and on every future term — by themselves. Change a phone number on Master and it updates everywhere.
- **A–H on the term tabs are formulas** that show what's on Master. To change any of those details, edit **Master** and it flows through. (They're no longer locked, so you *can* type over one if you must — just press Undo to restore the formula.)
- **Everything from column I onwards still belongs to the term** and is freely editable — Lessons, Adjustment, and all the status columns.
- **Starting a new term is now one right-click** — copy the term tab, rename it, clear columns I–R. Section 4a walks through it. The old separate template file is no longer needed.
- **Finished terms should be "frozen"** so a later rate change on Master can't rewrite history. One-off step per term, section 4a.

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

1. **Import Sheet** — click *Load Master Sheet* to pull the live spreadsheet (you can also drag-drop an Excel file, but normally you never need to). Once loaded, a **Term sheet dropdown** appears at the top-left of the summary bar — switch it to bill a different term (`AY 26 T2`, `T3`, `T4`, …); the table reloads for that term. The table is editable: rate, duration, lessons, fees, adjustments. Edited rows turn yellow and totals recalculate live. ⚠️ **Edits you make in this table do NOT change the master spreadsheet.** They only affect the PDFs being generated right now — nothing is written back to Excel. If a change should be permanent (e.g. a new tuition timing/duration or rate), edit the **spreadsheet** itself, not just the app table. Drag a column header's right edge to widen/narrow it if you need to read a long note in full.
2. **Generate Invoices** — creates a PDF per child. A child with multiple subjects gets **one** invoice with a line item per subject.
3. **Review & Approve** — each row has *Preview* (opens the PDF in a pop-up so you can check it before it goes anywhere), then Approve ✓ or Flag ⚠ (a flagged row expands so you can type a note about what's wrong). *Approve All Pending* for bulk. The bar at the bottom keeps a live count of approved / flagged / pending and the total dollar amount. Any student with **Lessons = 0** on this term's tab is treated as *not enrolled this term* — they're moved to a grey **"Not billed this term"** panel under the table and left out of the run (no invoice, not counted).
4. **Export** — approved invoices are written to the shared folder under **`Invoices\<term>\`** (e.g. `Invoices\AY 26 T3\`). Use the *Open folder* button, then send each PDF to the parent yourself.

### Receipts

1. A child appears as **ready for a receipt** once their **Paid** column in the spreadsheet is filled in (see section 4). Use the **Term sheet dropdown** in the top-right of the header to switch which term's receipts you're working on — the list, dates and sent-status all reload for the chosen term.
2. **Preview** (on every row) opens the receipt PDF in a pop-up so you can check the amount, dates and name before committing — **nothing is saved or issued**, and no receipt number is used. Optional, but handy for a quick sanity check.
3. **Generate** writes the PDF to **`Receipts\<term>\`** and automatically writes back into the spreadsheet: column **O** (Receipt Issued) gets the receipt number and date, and the cell turns **red** (issued, not yet sent).
4. **Mark as Sent** after you've sent it to the parent — ✅ **this DOES edit the master spreadsheet for you**, writing column **R** (Receipt Sent), e.g. `Sent 19/07/26`, and turning the Receipt Issued cell (column O) from red to **green**. (Generating the receipt in step 3 writes column O.) You don't have to fill these in by hand — unless the spreadsheet was open in Excel at the time, in which case the app can't write and warns you. The reverse also works: change column O/R **in Excel** and the app picks it up on the next ⟳ Refresh.
5. Receipt numbers are automatic and fixed: `R-AY26T3-013` = term AY 26 T3, serial 13. **Re-generating the same receipt can never create a second conflicting number** — the app warns you it's a duplicate and, if you proceed, overwrites the same file.
6. **The spreadsheet is what remembers — and you can edit it directly.** The app reads receipt status live from columns **O** (Receipt Issued) and **R** (Receipt Sent), not from anything stored on your computer. So the history is the same **on any computer, for any admin** — a brand-new install reads the shared file and immediately knows what's been issued and sent. And because those cells are the truth, editing them in Excel is a real change: **clear the `Sent` cell and the app un-marks it as sent; clear both O and R and the receipt goes back to un-issued** (on the next ⟳ Refresh).
   ⚠️ So treat clearing O/R as a deliberate **undo**, not housekeeping. It does **not** delete the receipt PDF already sitting in the `Receipts` folder — it only changes what the app shows and frees the row to be generated / marked again. Receipt numbers are fixed per student, so re-generating overwrites the same file — you can never end up with two conflicting receipts. If you just want to re-issue the same receipt, use the *Re-generate* button.

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

**The file:** `student details LATEST.xlsx` in the shared Drive folder. It has a **`Master`** tab followed by **one tab per term** (`AY 26 T2`, `AY 26 T3`, `AY 26 T4`):

| Tab | What it holds | Who edits it |
|-----|---------------|--------------|
| **`Master`** (first tab) | Columns **A–H only** — the details that stay the same term after term (name, parent, level, subject, rate…) | **You.** This is the one and only place a student is ever typed in |
| **Term tabs** (`AY 26 T2`, `AY 26 T3`, `AY 26 T4`) | Columns **A–H pulled from Master automatically** + columns **I–R** you fill in for that one term (lessons, adjustment, paid, receipts…) | You edit **I–R only**; A–H look after themselves |

**The golden rule in one line:** *type student details on **Master**, type each term's billing on that **term's tab (columns I–R)**, and never touch A–H on a term tab — they mirror Master by formula.*

**Which term the app bills.** In the app, pick the term from the **Term sheet dropdown** (on both the Import and Receipts pages) — it lists every tab except Master. The **default** term the app opens on is the **first tab after Master**, so keeping the current term right after Master is still tidy, but you can bill or receipt any term from the dropdown without rearranging tabs. Right now the default is **`AY 26 T3`**. (`T2` and `T4` exist but are blank until you fill in their columns I–R.)

### The `Master` tab — columns A–H

One row per **subject**. A child taking two subjects has two rows here, with A–E merged across them.

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

**To add a new student:** type them into the next free row on Master. They appear on the term tab immediately. Rows are linked down to **row 500**, so there is room for hundreds more students before anything needs extending.

### The term tab — columns I–R

Columns A–H here are **formulas** showing what's on Master (edit them on Master, not here). Everything below is yours to fill in for that term:

| Col | Field | What to type — with example | Notes |
|-----|-------|------------------------------|-------|
| I | Lessons | `12` | Number of lessons in the term. **Blank = the standard 12.** A number bills that many (e.g. `6` for a mid-term joiner). **`0` = not enrolled this term** — the student is skipped from the invoice run entirely (no invoice, not counted) |
| J | Adjustment ($) | `-80` or `90` | **One figure, plus or minus.** Minus reduces the bill (missed lessons, discount, shorter lessons); a plain number adds to it (extra session, assessment book). Prints on the invoice as a single "Adjustment" line for that subject. Leave blank or `0` if none |
| K | Adjustment Notes | `2 lessons missed, not replaced` | **Your own reference only — never printed on the invoice or receipt.** Write whatever helps you remember why column J is what it is |
| L | Invoice Issued | `1/7/26` (or `yes`) | Admin fills manually — your own tracking |
| M | Paid | `yes`, `PayNow`, or `13/7/26` | Anything except no/n — see "Paid rule" below |
| N | Date of Receipt | `13/7/26` | **Date the payment arrived — this exact date prints on the receipt** ("received a payment … on 13/07/26") |
| O | Receipt Issued | *leave alone* | **App writes this**: `R-AY26T3-015 · 14/07/26`, and fills the cell **red** (issued) then **green** (sent) |
| P | Different End Date | `2/8/26` (usually empty) | Only if a child ends the term early/late — **prints as that child's term end date on the receipt** |
| Q | Backed Up | `yes` / `✓` | Admin's own tracking, not used by the app |
| R | Receipt Sent | *leave alone* | **App writes this** when you click Mark as Sent: `Sent 14/07/26` |

### How a bill is worked out

For **each subject row**:

```
Lesson Fee = Rate/hr (H) × Duration (G) × Lessons (I)
Subtotal   = Lesson Fee + Adjustment (J)
```

Then:

```
Grand Total = the subtotals of all of the child's subject rows added together
```

The Adjustment is added, so a **negative** number subtracts. Worked example — a child taking two subjects:

| | Maths | Science |
|---|---|---|
| Rate × Duration × Lessons | $40 × 2 × 12 = **$960** | $40 × 1.5 × 12 = **$720** |
| Adjustment (J) | **+$45** (assessment book) | **−$75** (2hr → 1.5hr from Wk 5) |
| **Subtotal** | **$1,005** | **$645** |

**Grand Total = $1,005 + $645 = $1,650.** The invoice shows four lines (Lesson Fee and Adjustment for each subject); the two notes in column K appear nowhere on it. A negative adjustment prints with a minus sign: `-$75.00`.

### Dates — how to type them

- Just type dates naturally, e.g. **`13/7/26`**, and press Enter — Excel converts it into a proper date cell and the app reads it correctly, showing it as `13/07/26`. Typing it as plain text also works.
- Keep to **day/month/year** order (Singapore style). Avoid ambiguous or American formats like `7/13/26`.
- The two dates parents actually see are **O (Date of Receipt)** and **Q (Different End Date)** — both print word-for-word on the receipt, so double-check those two.
- If a date ever shows up as a plain number like `46216` in the app or on a PDF, you're running an outdated version of the app — install the current installer from the Drive folder.

### Children with more than one subject — the merged-cell rule

One row = one subject. A child taking two subjects takes **two rows**.

**On the `Master` tab:**

- Put the child's details (columns A–E) on the **first** row only.
- **Merge** columns A–E vertically across the child's rows (select the cells → Merge & Center). At minimum, leave Student Name (B) **blank** on the extra rows — a blank/merged name cell is how the app knows "this row is another subject for the child above".
- Columns **F, G, H** (Subject, Duration, Rate) stay filled in on **every** row, because they differ per subject.

**On the term tab:** you don't need to do anything. Columns A–H are formulas, and the continuation row simply comes through blank — exactly the blank the app is looking for. Do merge the **status columns L–R** across the child's rows, since those belong to the child rather than to one subject.

⚠️ **Never repeat the child's name on the second row.** The app will treat it as a duplicate child, warn about the reused serial, and could produce two invoices. Blank or merged = same child; name filled in = new child.

### The "Paid" rule (column M)

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

### Do the app and Excel fight over the file?

You can have the app open all the time — it only *reads* the spreadsheet. Two simple rules keep them in step:

- **Made a change in Excel?** Save it (Ctrl+S), then click **⟳ Refresh** in the app (or reload the page). The app re-reads the file and shows your change. You do **not** need to close the app.
- **About to generate a receipt or click Mark as Sent?** Those are the only times the app *writes* to the file. If the spreadsheet is open in Excel at that moment, Windows won't let the app write, so it shows a warning and the cell isn't updated. **Close the file in Excel first** (or close it and click the button again). The receipt PDF is still created either way.

In short: editing in Excel and reading in the app can happen together; only the app's *write-back* (receipt number, sent date, red/green) needs Excel closed for that moment.

### Other rules

- **Close the spreadsheet before generating receipts.** If the file is open in Excel, the receipt PDF still generates but the app can't write columns O/R — it will warn you, and you must fill in the cell by hand (or close Excel and re-generate).
- **Header row stays on row 1.** Data starts from row 2.
- **Make a backup copy before big edits** (e.g. setting up a new term). Just copy the file in Drive and add the date to the name.
- **Never delete or rename the `Master` tab**, and don't move it off the front. Every term tab reads from it by name.
- **New term = a copy of the term tab**, named after the term (e.g. `AY 26 T4`) — see section 4a. Then update the term schedule in Settings.
- The file must stay under **10 MB** (it will be nowhere near this in normal use).

---

## 4a. Adding students, starting a term, closing a term

### Adding a new student — 30 seconds

1. Open **`student details LATEST.xlsx`** and go to the **`Master`** tab.
2. Type the child into the next free row: Serial No, Name, Parent, POC, Level, Subject, Duration, Rate (columns A–H).
3. If they take two subjects, add a second row for the second subject, leave the name blank on it, and merge A–E across both rows.
4. Save.

That's it. They now appear on the current term tab automatically. Go to that tab and fill in their **Lessons (I)** for this term.

### A student who joins or leaves mid-term

Because a student typed on **Master** appears on **every** term tab, the only thing you set per term is that term's **Lessons (I)**. That one number handles every "partial" case:

- **Joins mid-term** — put the number of lessons they'll actually attend this term (e.g. `6` instead of 12). The bill pro-rates automatically (`Rate × Duration × 6`), and the invoice prints "6 lessons" so the parent sees exactly what they paid for. Use **Adjustment (J)** + a note in **K** for any joining discount or half-lesson tweak.
- **Not in this term at all** (e.g. you've added them to Master ready for **next** term) — set this term's **Lessons to `0`**. They drop into the grey "Not billed this term" panel and are skipped from the run. On the next term's tab, leave Lessons blank (= 12) or type the real number, and they bill normally.
- **Leaves partway** — set Lessons to how many they had before leaving; optionally record their last date in **Different End Date (P)** so the receipt shows the right term-end.

You never delete or hide anyone — Master stays the full roster, and each term's Lessons column decides who is billed and for how much. Remember: **blank = 12**, `0` = not billed, any other number = that many lessons.

### Starting a new term

**The easy case — the tab already exists.** `AY 26 T2`, `AY 26 T3` and `AY 26 T4` are all in the workbook already, with `T2` and `T4` sitting blank and ready. To start one of them:

1. In the app, choose it from the **Term sheet dropdown** (Import / Receipts pages). Optionally drag its tab so it sits **immediately after `Master`** — that just makes it the term the app *opens on* by default; the dropdown can reach any term regardless.
2. Its A–H columns are already linked to Master — **leave them alone**. Fill in **Lessons (I)** for the term, plus any **Adjustment (J)** and **Adjustment Notes (K)**. Leave the status columns (L–R) for the app and your day-to-day tracking.
3. Update the term dates in **Settings → Clause 2 Term Schedule** so the invoices print the right period.

**If you ever need a brand-new term tab** (e.g. a new academic year, `AY 27 T1`):

1. Right-click any current term tab → **Move or Copy…** → tick **Create a copy** → OK.
2. Rename the copy to the new term. The tab name becomes the PDF folder name, so name it sensibly and keep the `AY <yy> T<n>` shape (the app reads the term number from it).
3. On the new tab, **clear columns I–R** (the term's own data and status). **Leave A–H alone** — they're formulas and keep working by themselves.
4. Then follow steps 1–3 of the easy case above.

Nothing is ever copied and pasted between sheets, so the columns cannot drift out of line. *(For the maintainer: `node scripts/add-term.js "<workbook>" "AY 27 T1"` creates a fresh, correctly-styled blank term tab in one command — it clones the layout, keeps A–H linked to Master, and blanks I–R. It appends after the existing tabs so the current term stays first.)*

### Closing a term — "freezing" it

When a term is finished and all its invoices and receipts have gone out, freeze it.

**Why:** columns A–H on a term tab are live links to Master. If you raise a rate on Master next year, that old term would quietly show the new rate and stop matching the invoices parents were actually sent. Freezing turns the links into plain text so the tab becomes a permanent record.

**How (in Excel, takes 10 seconds):**

1. Go to the finished term's tab.
2. Select **A2:H500**.
3. **Copy** (Ctrl+C), then **Paste Special → Values** (right-click → Paste Options → the `123` icon).
4. Save.

The tab looks identical — the difference is it no longer changes when Master changes. Do this **only** to terms that are over, never to the current one.

*(For the maintainer: `node scripts/freeze-term.js "<workbook>" "AY 26 T3"` does the same thing, with `--dry-run` to preview. It refuses to touch the Master tab.)*

⚠️ **Never insert, delete or reorder a column** on any tab. The app finds every field by its column position, not by its heading — a single inserted column silently shifts everything after it and the app will read material fees as lesson counts. If a column heading looks wrong, retype the heading; don't move the column.

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
Clear columns **O** (Receipt Issued) and **R** (Receipt Sent) of any practice entries first. The app treats those columns as the real record, so leftover test values make children look like they already have receipts — and trigger a false "already exists" warning when the genuine one is issued. Leave column M (Paid) alone if you want the new admin to be able to try generating a receipt straight away.

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
| No duplicate warning when you expected one | Column O (Receipt Issued) was cleared or overwritten by hand. That column is how the app remembers — restore it, or use *Re-generate* rather than deleting. |
| App shows outdated numbers | The pages read live on load; use the ⟳ Refresh button on the Receipts page, or reload the page. Also check Drive has finished syncing (tick icon). |
| Duplicate receipt warning | You already issued this receipt. Proceeding re-issues with the **same** number and overwrites the same PDF — safe if you meant to re-issue. |
| Invoice PDF missing an Adjustment line | The Adjustment line only prints when the amount in column K is not zero. A note in column L never prints on its own — column L is internal (see "Recent changes" above). |
| Columns A–H on a term tab show a formula, not what I typed | Those columns are linked to the `Master` tab — make the change on **Master** and it updates here automatically (Section 4a). They're no longer locked, so if you typed over one and lost the link, press Undo. |
| A student I added to Master isn't showing on the term tab | Check three things: they went on **Master** (not the term tab); their row is at or above **row 500**, where the links stop; and the file has been **saved**. If the row is below 500, copy the row above it down to extend the links. |
| A term tab shows `0` where a name should be | The link lost its blank-check. Each cell should read `=IF(Master!B2="","",Master!B2)` — the `IF` is what turns an empty Master cell into a blank instead of a zero. |
| An old term's fees changed by themselves | That term was never frozen, so it's still linked to Master and followed a rate change. Freeze finished terms — Section 4a, "Closing a term". |
| The app is billing the wrong term | Pick the right one from the **Term sheet dropdown** (Import and Receipts pages). The dropdown's default is the first tab after Master — drag your current term there if you want it selected on open. |
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
- **Workbook shape:** tab 1 is `Master` (identity columns A–H, typed once). Every following tab is a term and pulls A–H with plain per-cell formulas `=IF(Master!A2="","",Master!A2)` down to row 500. Deliberately **not** IFERROR (a blank source is not an error — it evaluates to 0, which would show as zeros) and deliberately **no** dynamic-array/spill formulas (XLOOKUP/FILTER/Table[#Data]), which do not survive being written by script and reopened. Nothing is locked or protected — the owner preferred it that way; the formulas simply keep A–H in step with Master.
- **Zero-lesson / not-billed students:** `parseWorkbook` reads Lessons with `numValOr(row, col, 12)` — a genuinely blank cell defaults to 12, but a typed `0` stays 0 (the old `numVal(...) || 12` wrongly turned 0 back into 12, so a student could never be zeroed out). The invoice review page (`app/invoices/page.tsx`) treats a student with `totalFee === 0 && totalLessons === 0` as not enrolled this term (`isBilledThisTerm`) — excluded from counts, Approve-All, and export, and shown in a separate "Not billed this term" panel. A student with lessons but a $0 total (fully discounted) or a pure fee (0 lessons, positive adjustment) stays billable.
- **Sheet selection:** the app defaults to the first worksheet whose name is not `Master` (`activeTermSheet()` in `lib/parse-students.ts`), but the Import and Receipts pages expose a **term dropdown** built from `listTermSheets()` (every tab except Master, in tab order). The client passes the chosen tab as `GET /api/students?sheet=<name>`; `parseWorkbook(buffer, requestedSheet?)` only honours a real non-Master tab and otherwise falls back to the active term (so `?sheet=Master` or a bogus name can never bill Master, which would silently default lessons to 12 with nobody marked paid). The response always includes `sheetNames` so the dropdown reflects whatever tabs currently exist. Receipt reads/writes key off the selected term via the existing `?term=` param.
- **Formula cells and cached values:** the app reads Excel's *cached* results, so a workbook whose formulas were written by a script must be opened and saved in Excel once before the app can read it. Day-to-day editing in Excel does this automatically. `lib/sheet-writeback.ts` resolves `{formula, result}` cells when matching serial numbers — reading the raw value yields NaN and would break write-back for every student.
- **Adding a term tab:** `scripts/add-term.js <workbook> "AY 26 T2" ["AY 26 T4" …]` clones an existing term tab (default: the first non-Master tab, override with `--from "<tab>"`) into fresh blank term tabs — copying layout, column widths, per-child banding and header styling, keeping A–H linked to Master (formula **and** cached result, so the app reads names before Excel ever reopens it), and blanking columns I–R. It also resets each data cell's fill to the row's base banding colour, so no leftover red/green receipt shading carries over from the template. New tabs are appended after the existing ones so the current term stays first. The `AY 26 T2` and `AY 26 T4` tabs were created with it.
- **Freezing a term:** `scripts/freeze-term.js <workbook> <tab>` converts A–H formulas to values (`--dry-run` supported). Refuses the Master tab, and aborts if no identity cell has a calculated value, since a formula that evaluates to blank is stored without a cached result and is otherwise indistinguishable from one Excel has never calculated.
- **Receipt history (spreadsheet-authoritative, two-way):** the master spreadsheet is the source of truth — column **O** (Receipt Issued) and column **R** (Receipt Sent), written automatically on generate / Mark as Sent and parsed back on load. Receipt numbers are deterministic (`R-<TERMSLUG>-<serial padded to 3>`), so nothing needs to be looked up or carried between machines. The receipts list computes each row's status from those cells only (`receiptState(student)` with no ledger — `lib/receipt-status.ts`), so the sheet's **blanks win**: clearing O/R in Excel undoes the status on the next reload, and an in-app Generate / Mark as Sent optimistically patches the in-memory row (`patchStudent`) so it flips immediately, then re-syncs from the sheet on the next load. The local **ledger** (`receipts-ledger.json`, alongside the config; serial numbers only, no names, by PDPA design) is still written for audit and used as a last-resort fallback **only** when the sheet is completely silent for a child (`receiptState` called *with* a ledger entry, e.g. the duplicate-confirm modal) — it never revives a status the sheet no longer shows. Write-back (`lib/sheet-writeback.ts`, `withSheet`) targets `wb.getWorksheet(term)` where `term` is the tab selected in the receipts dropdown, so edits only ever land on the chosen term's tab (verified: Mark as Sent on one term leaves the others untouched).
- The app runs entirely on the local machine (localhost, random port); no data leaves the computer except files written to the Drive folder.
