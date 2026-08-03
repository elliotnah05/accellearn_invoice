# AccelLearn Invoices & Receipts — Owner & Admin Guide

**App:** AccelLearn Invoices (Windows & Mac desktop app)
**Last updated:** 2 August 2026 (v0.13.1)
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

**Status lives in the spreadsheet, and the marks are the gate.** The app reads invoice status from column **L** and receipt status from columns **O** and **R** — identical on every computer — and **a marked row is never output again**: no re-export of an invoice while L is filled, no re-generation of a receipt while O is filled. The app offers no override; re-issuing is always an Excel decision. Clear **L** to allow an invoice again; clear **R** to un-send; clear **both O and R** to fully cancel a receipt. Then save and **⟳ Refresh**. Clearing marks doesn't delete PDFs already in the folder. (See the cancellation note in §8.)

### Status

A read-only overview: who's invoiced / paid / has a receipt issued / sent, with count tiles. Every figure is read **from the spreadsheet**, so it matches what the Invoices and Receipts pages show and looks the same on every admin's computer.

⚠️ Status always shows the **first term tab after Master** — it has no term dropdown. Keep the current term directly after Master (§4) and it will always show the term you're working on.

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
| A | Serial No | `15` | Display only — renumbers itself when rows change. Nothing depends on it |
| B | Student Name | `Jayden Tan` | Child's **first** row only |
| C | Parent Name | `Mrs Tan` | Printed on invoice & receipt |
| D | School | `Raffles Institution` | Admin reference only — not printed anywhere, no logic reads it |
| E | Level | `Sec 3` | Printed as the child's level |
| F | Subject | `Mathematics` | One per row |
| G | Duration (hrs) | `2` | Blank = 2 |
| H | Rate/hr ($) | `55` | Number only. **Required** |
| I | Student ID | `S015` | **App writes this — leave it alone.** The child's permanent code: it never changes and is never given to anyone else, even after they leave. It's what ties a child to their invoices and receipts (the serial number can't — it renumbers). It appears on invoice/receipt numbers and PDF filenames so you can cross-check |

Add a student = type them into the next free Master row (linked down to **row 1000**). Their Student ID appears by itself the next time the app refreshes (spreadsheet closed in Excel).

### Term tab — columns I–R

A–H are formulas from Master. Fill in I–R for the term:

| Col | Field | Example | Notes |
|---|---|---|---|
| I | Lessons | `12` | **Blank = 12.** A number bills that many (`6` for a mid-term joiner). **`0` = not enrolled this term** (skipped from the run) |
| J | Material Fee ($) | `-80` or `90` | One figure, ± . Minus discounts, plain number adds. Prints as one "Material Fee" line. Blank/`0` = none |
| K | Material Fee Notes | `2 lessons missed` | **Internal only — never printed.** Your reminder of why J is what it is |
| L | Invoice Issued | *app writes* | `INV-AY26T4-S015 · 01/08/26` — stamped automatically the moment the app exports that child's invoice to the shared folder (the stamp carries their Student ID, so the app can spot a mark that's drifted onto the wrong row). **This mark is the gate: a marked row is never exported again** — the app offers no way around it. To re-issue, clear the cell in Excel, save, and **⟳ Refresh**; the row becomes exportable again |
| M | Paid | `yes` / `PayNow` / `13/7/26` | Anything except empty/no = paid — see **Paid rule** |
| N | Date of Receipt | `13/7/26` | **Prints on the receipt** ("received a payment … on 13/07/26") |
| O | Receipt Issued | *app writes* | `R-AY26T3-015 · 14/07/26`; red (issued) → green (sent). Clear it to cancel — see §8 |
| P | Different End Date | `2/8/26` | Only if a child ends early/late — **prints as their term-end on the receipt** |
| Q | Backed Up | `yes` | Your own tracking |
| R | Receipt Sent | *app writes* | `Sent 14/07/26`. Clear it to un-send — see §8 |
| S | Student ID | *auto* | Mirrors Master's column I by formula, like A–H. **Leave it alone** |

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
- **Writing:** the app writes on exactly three actions — **Export invoices** (stamps column L), **Generate a receipt** (column O), and **Mark as Sent** (columns R + O). If the file is open in Excel at that moment, the write is blocked and the app warns you — close Excel and do it again. The PDFs are still created either way.

### Other rules

- **Header row stays on row 1**; data from row 2.
- **Back up before big edits** (copy the file, add the date to the name).
- **Never delete/rename `Master` or move it off the front** — every term tab reads it by name.
- **Never insert, delete, or reorder a column** — the app finds each field by its position, so a shifted column breaks everything. Retype a wrong heading; don't move the column.
- **Never sort or rearrange rows on Master.** The name columns on term tabs would move but each term's lessons/fees/receipt marks would stay put — attached to the wrong children. The app detects this and warns; if you see that warning, close without saving or restore the previous version from Drive (right-click the file → Version history).
- **Add new students at the BOTTOM of Master, never insert a row in the middle.** A middle insert makes the new student invisible on the term tabs (the app will warn you they're "not appearing").
- **Don't type, copy-drag, or edit Student IDs (Master column I / term column S).** The app assigns them. The one exception: re-adding a returning student with the same ID they had before (§5).
- Keep the file under **10 MB** (normal use is far below).

### Safeguards — what the app checks, and what only you can prevent

Every student has a permanent **Student ID** (Master column I, mirrored to term column S). It is assigned by the app, never changes, and is never given to anyone else. It is what ties a student to their invoices and receipts, which is why students can be added or removed freely without disturbing anyone else's records.

**Checks the app runs for you.** Each time you press **⟳ Refresh** (or open the invoice/receipt screens), the spreadsheet is inspected. Anything below appears as a yellow **"Spreadsheet needs attention"** panel naming the exact student or row:

| Situation | What you'll see |
|---|---|
| A new student has no Student ID yet | Assigned automatically. If the file is open in Excel, you're asked to close it and refresh |
| A Student ID cleared by accident | Recovered automatically from that student's existing invoice/receipt marks |
| The same Student ID on two students | Both are named, and their **Generate** / **Approve** buttons lock until it's corrected |
| A status mark sitting beside the wrong student (rows shifted) | Named, with a prompt to restore the file before generating anything |
| A student added anywhere on Master — including between two existing rows | Given a row in the same position on every live term tab automatically, so they're never left unbilled |
| A student removed by clearing their Master row instead of deleting it | The lessons/fees left behind on the term tab are cleared, so they're billed to nobody (and never added to the student above) |
| A student removed after a term was frozen | The frozen term keeps their row and their figures — it is the record of a term they really were billed for. Only live terms drop them |
| Marks copied from a previous term onto a new tab | The tab is named, with a reminder to clear columns I–R |
| The order of students changed since the last refresh | Flagged as a possible accidental sort, with recovery instructions |
| A leftover `#REF!` row from a student you deleted | Deleted automatically on the next Refresh (spreadsheet closed in Excel). Nobody is ever billed from it |

**Responsibilities the app cannot take over.** These change the meaning of the data itself, so no automatic check can decide the right outcome — please follow them as standing practice:

1. **Do not sort or reorder rows on Master.** Names on term tabs would move while each term's lessons, fees and receipt marks stay in place. The app will warn you, but the fix is manual — restore the previous version of the file (in Google Drive: right-click the file → **Version history**).
2. **Leave the Student ID columns alone** (Master **I**, term **S**). Never type, autofill or copy-drag them. The single exception is re-adding a returning student with the ID they had before.
3. **Clear columns I–R when you create a term tab by copying another one.**
4. **Freeze a term once it is finished** (§5) — otherwise a later change to a rate on Master would rewrite that term's completed figures.
5. **One person edits the spreadsheet at a time.** It lives in a shared Drive folder; if two people save at once, the later save wins and the earlier edits are lost.
6. **Check that Drive has finished syncing** before and after a billing run, so every admin is working from the same file.

If a warning ever appears that you don't understand, the safe response is the same: **don't generate anything, and restore the file's previous version from Drive version history.** Documents already saved in the shared folder are never affected by this.

---

## 5. Common tasks

### Add a new student (30 seconds)
Master tab → **wherever they belong** → Name, Parent, School, Level, Subject, Duration, Rate → Save. (Serial No fills itself in; the app assigns their **Student ID** on the next refresh.) Two subjects? Add a second row directly under them, leave the name blank, merge A–E.

**Put them where they belong in the list.** Master is grouped by level (P3 → JC2), so a new P3 goes among the other P3s: right-click the row *below* where they should sit → **Insert** → type them in. You do not have to add people at the bottom, and inserting in the middle does not disturb anybody else — every other student keeps their own lessons, fees, payments and receipt marks, because each term row follows its own student, not its position.

On the next **⟳ Refresh** (spreadsheet closed in Excel) the app gives the new student a row in the same position on every live term tab and assigns their Student ID. Then go to the term and set their **Lessons (I)** — a blank cell bills the standard 12, so a mid-term joiner needs the real number typed in.

### A student who joins or leaves mid-term
Master stays the full roster; each term's **Lessons (I)** decides who's billed and how much:
- **Joins mid-term** → put the lessons they'll actually attend (e.g. `6`). The bill pro-rates and the invoice prints "6 lessons". Use **Material Fee (J)** for any joining discount.
- **Not in this term** (added ahead for next term) → set **Lessons = 0** → they drop into "Not billed this term". Next term, blank (= 12) or the real number.
- **Leaves partway** → set Lessons to what they had; optionally set **Different End Date (P)** for the receipt.

Remember: **blank = 12, `0` = not billed, any number = that many.**

### A student who leaves for good (delete their row)
1. **Finish their paperwork first** — their last invoice is already out; if a final payment comes in, mark it Paid and generate their receipt as normal. The app can only generate documents for students still on the sheet.
2. **Delete their row on `Master` only** — right-click the row number on the left edge → Delete. A two-subject child has two rows, so delete both. **You do not need to touch the term tabs.** Master is the one place a student is typed, and the one place they're removed.
3. Save. The serial numbers close up by themselves and the student disappears from every **live** term tab. A **frozen** term (§5) keeps their row — it is the record of a term they really were invoiced for, and it must not change.
4. That's it. Nobody else's records move: every other child keeps their Student ID, so all invoices, receipts and stamps stay attached to the right people. The leaver's PDFs stay safely in the shared Drive folder, and their ID is never given to anyone else.
5. **Nothing else to do.** If a `#REF!` row briefly appears on a term tab, that is just the empty shell of the row you removed — the app deletes it for you on the next Refresh (with the spreadsheet closed in Excel). You never need to tidy the term tabs by hand.
6. **Deleted too soon and need their invoice again?** Usually the PDF in the Drive folder *is* the record. If it's truly lost: re-add their row on Master and type their **old Student ID** into column I by hand (it's in the PDF filename), generate, then delete again.

> **Why Master only?** Each term tab pulls its names from Master by formula. When you delete a row on Master, Excel moves every other row's link along with its student, so the rest of the tab stays correctly matched to the right people. Only the departed student's own row is left behind, and the app removes it for you. If you clear the row's contents instead of deleting the row, the app clears the lessons and fees left stranded on the term tabs instead — either way, nobody is billed from it and no one else is touched.

### Freeze a finished term
When a term is over and its invoices and receipts have gone out, freeze it so a later edit on Master can't rewrite what parents were already sent:

```
node scripts/freeze-term.js "<path to the spreadsheet>" "AY 26 T4"
```

By hand in Excel: select **A2:H1000** and **S2:S1000** on that tab, Copy, then **Paste Special → Values**. That converts the linked columns (names, rates *and* the Student ID) into plain text. From then on the app treats the tab as a closed record: students who join later are not added to it, students who leave later are not removed from it, and nothing on it is rewritten.

### Start a new term
Most terms already exist as blank tabs. To start one:
1. Pick it in the **Term sheet dropdown** (optionally drag its tab right after Master to make it the default).
2. Leave A–H alone; fill in **Lessons (I)** (+ Material Fee) for each child.
3. Update **Settings → Clause 2 Term Schedule** so invoices print the right dates.

Need a brand-new tab (e.g. `AY 27 T1`)? Right-click a term tab → **Move or Copy → Create a copy**, rename it (keep the `AY <yy> T<n>` shape), **clear columns I–R**, then follow the steps above. (Forgot to clear? The app notices — the copied marks name their old term — and tells you which tab to clean.)

### Close a finished term ("freeze" it)
A–H (and Student ID in S) on a term tab are live links to Master, so a future rate change would rewrite an old term's fees. Freeze a term once it's fully done: select **A2:H1000** → **Copy** → **Paste Special → Values**, do the same for **S2:S1000**, then Save. It looks identical but no longer changes with Master. Only freeze terms that are over.

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

**Before handing over a spreadsheet used for testing:** clear columns **L**, **O** and **R** of any practice entries on every term tab (leftover values make children look like they were already invoiced or already have receipts). Also check the **current term tab sits directly after Master** — the app opens on the first tab after Master, so a finished term left in front means it opens on the wrong term. Leave column M (Paid) if you want the new admin to be able to try a receipt straight away.

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
| Status page shows a different term than the one I'm billing | Status has no term dropdown — it always reads the **first tab after Master**. Drag the current term tab to sit directly after Master. |
| App shows outdated numbers | Save in Excel, then ⟳ Refresh (or reload the page). Check Drive has finished syncing. |
| Invoice missing a Material Fee line | It only prints when **column J** isn't zero. The note in **column K** never prints (internal). |
| Invoice Issued (L) didn't get stamped | The app only writes it when you **Export to Folder** from the invoice review screen — previewing or downloading a single PDF doesn't touch the sheet. If it still shows blank after exporting, the sheet was probably open in Excel at that moment (check the banner on the export screen); close Excel and export again. |
| Cleared Invoice Issued in Excel but the app still shows it issued | Save in Excel (Ctrl+S), then click **⟳ Refresh** on the invoice review screen — same as receipts, edits aren't visible until the file is saved and the app re-reads it. |
| A term tab shows a formula / `0` where a name should be | A–H are linked to Master — edit **Master**. A `0` means the link lost its blank-check; the cell should read `=IF(Master!B2="","",Master!B2)`. |
| A student added to Master isn't on the term tab | Confirm they're on **Master**, at or above **row 1000**, and the file is **saved**. The app adds them on the next **⟳ Refresh** — it can only write while the spreadsheet is **closed in Excel**. A *frozen* term tab (§5) is deliberately never topped up. |
| Yellow "Spreadsheet needs attention" panel | Read the lines in it — each names the exact student or row and the fix. See §4, *Safeguards*. Don't generate documents until it's cleared. |
| "This student has no Student ID yet" | The spreadsheet was open in Excel when the app tried to assign one. Close Excel, click **⟳ Refresh**, and the ID appears. |
| Red **⚠ Duplicate ID** on a student's row | Two students share a Student ID (usually from copy-dragging column I). On **Master**, clear the ID of the student who was added later, save, close Excel, then **⟳ Refresh** — a fresh ID is assigned and the buttons unlock. |
| "The ORDER of students changed" warning | Rows were sorted or moved on Master. If it wasn't deliberate, restore the previous version (Drive → right-click the file → **Version history**). If it was deliberate, refresh once more and the notice clears. |
| "…mark is from AY26T4, not AY27T1" | A term tab was copied from a finished term without clearing it. Select **I2:R1000** on the new tab, delete, save. |
| A returning student needs their old records back | Re-add them at the bottom of Master and type their **previous Student ID** into column I by hand — it's in their old invoice/receipt filenames. |
| An old term's fees changed by themselves | It was never frozen — freeze finished terms (§5). |
| App billing the wrong term | Pick the right one in the **Term sheet dropdown**. |
| A date shows as a number (`46216`) | Outdated app — install the current one. |

---

## 9. Technical reference (owner / maintainer)

Admins can ignore this section.

- **Installers:** GitHub Actions builds Win (NSIS `.exe`) + Mac (universal `.dmg`, unsigned) on every pushed tag (`git tag v0.x.y && git push origin v0.x.y`) and attaches them to one Release (~10–15 min). Keep `package.json` version in step with the tag. Stable links: `…/releases/latest/download/AccelLearn-Invoices-Setup.exe` and `…/AccelLearn-Invoices.dmg`. Local build: `npm run build && npm run dist` in `app/`.
- **Source:** repo `accellearn_invoice` (scoped to `app/`), Next.js 16 + Electron. Per-machine config: `%APPDATA%\app\data\template.json` (prefer the in-app Settings).
- **Workbook shape:** tab 1 `Master` (A–H typed once, **I = Student ID** written by the app); each following tab is a term pulling A–H via `=IF(Master!A2="","",Master!A2)` and **S** via `=IF(Master!I2="","",Master!I2)`, down to row 1000. Deliberately not IFERROR (a blank isn't an error) and no spill formulas (they don't survive a script write + reopen). Nothing is locked.
- **Sheet selection & term picker:** defaults to the first non-Master tab (`activeTermSheet()`); the Import/Receipts dropdowns list `listTermSheets()` and pass the choice as `GET /api/students?sheet=<name>`. `parseWorkbook(buffer, requestedSheet?)` only honours a real non-Master tab (so Master is never billed). The response includes `sheetNames`.
- **Lessons / not-billed:** `numValOr(row, col, 12)` — blank → 12, typed `0` stays 0. The review page excludes `totalFee === 0 && totalLessons === 0` (`isBilledThisTerm`) into the "Not billed" panel.
- **Cached formula values:** the app reads Excel's *cached* results, so a script-written workbook must be opened + saved in Excel once (normal editing does this). `sheet-writeback.ts` resolves `{formula, result}` cells when matching serials.
- **Receipt status (spreadsheet-authoritative, two-way):** deterministic numbers `R-<TERMSLUG>-<serial×3>`. The receipts list reads status from columns O/R only (`receiptState(student)` with no ledger — `lib/receipt-status.ts`), so the sheet's blanks win; in-app actions optimistically `patchStudent` the row, then re-sync on reload. The local ledger (`receipts-ledger.json`, serials only, PDPA) is a last-resort fallback used only when the sheet is silent for a child (dup-confirm modal), and never revives a cleared status. Write-back (`withSheet`) targets `wb.getWorksheet(term)` = the selected tab, so edits land only on that term.
- **Scripts:** `scripts/add-term.js <workbook> "<tab>" …` clones a blank, correctly-styled term tab (A–H linked + cached, I–R blank, banding reset); `scripts/freeze-term.js <workbook> <tab>` converts A–H to values (`--dry-run` supported, refuses Master).
- The app runs entirely locally (localhost, random port); nothing leaves the computer except files written to the Drive folder.

---

## Version history

- **v0.14.0** — **The issued marks are now the gate.** A row with anything in **Invoice Issued (L)** is never exported again, and a row with anything in **Receipt Issued (O)** is never generated again — the app offers no override (the "re-create it?" confirmation and Re-generate button are gone). To re-issue, clear the cell in Excel, save, and Refresh; receipt numbers are deterministic, so a deliberate re-issue re-uses the same number and replaces the same file. Also: **two different children sharing a full name are now both billed** — matching for children without an ID uses name **plus parent**, so a namesake no longer makes the second child silently invisible; if two rows share the same name *and* parent, the app warns, locks their documents, and offers a deliberate per-row *Approve/Generate anyway* for the rare case they really are different children (duplicate Student IDs stay locked with no override). Leftover deletion rows on future terms (which hold no typed data and used to escape detection entirely) are now cleaned like all the rest, and the tidy pass runs on every Refresh.
- **v0.13.1** — **A frozen term is now genuinely closed.** Removing a student used to delete their row from finished terms too, erasing the record of invoices those terms really did issue; frozen tabs are now left untouched, and `freeze-term.js` also freezes the Student ID column (leaving it linked was what let a later deletion reach in). If a term was frozen by the older script, the app repairs its broken ID cells from the invoice/receipt marks on the same row. Also: when the spreadsheet can't be written because Drive has it locked or the file is read-only, the app now says to close the spreadsheet and refresh, instead of a vague "could not update".
- **v0.13.0** — **Add a student anywhere on Master, not just at the bottom.** Inserting a row in the middle — next to the others of their level, which is how the roster reads — used to leave the new student invisible on every term tab and silently unbilled. The app now gives them a row in the same position on every live term tab (frozen terms are left alone), fills in their linked details and assigns their Student ID, all on the next Refresh. Adding an extra subject under an existing student works the same way. Removing a student by *clearing* their Master row (rather than deleting it) is now handled too: the lessons and fees stranded on the term tab are cleared instead of being quietly added to the student above.
- **v0.12.2** — **The term tabs now clean themselves up.** After a student is removed on the Master tab, the empty row Excel leaves behind on each term tab is deleted automatically on the next Refresh, so removing a student really is a single action in a single place and there is nothing left to look at or tidy by hand.
- **v0.12.1** — **Removing a student is now done on the `Master` tab alone.** Previously a deleted student left a broken row on each term tab that the app mistook for an extra subject of the student above, quietly inflating that student's fee. Those leftover rows are now recognised and skipped entirely, so nothing is billed from them and no one else is affected; the app mentions them only as optional tidy-up. Row numbers in messages now match the row numbers shown in Excel.
- **v0.12.0** — **Permanent Student IDs.** Every child gets a code (`S001`, `S002`…) in Master column I, assigned by the app automatically and **never reused**. All matching — invoice numbers, receipt numbers, the marks written into columns L/O/R — now keys on this ID instead of the serial number, so **deleting or reordering students can no longer shift anyone's invoice/receipt history** (the bug where a deletion made the app re-issue invoices for everyone below). Serial No is now display-only. Invoice Issued stamps changed from `Yes` to `INV-… · date` so every mark identifies its child; the app detects and warns about marks sitting on the wrong row, leftover rows from deletions, and missing/duplicate IDs. Term-tab links to Master extended from row 500 to **row 1000** (the whole formatted sheet). Also added: automatic checks each refresh for duplicate IDs, marks sitting beside the wrong student, students missing from a term tab, marks copied from another term, and accidental re-sorting of Master — each shown as a "Spreadsheet needs attention" panel naming the student or row (§4, *Safeguards*). One-time upgrade: `node scripts/add-student-ids.js "<workbook.xlsx>"` (makes a backup, IDs all current students, audits for leftover deletion damage).
- **v0.11.2** — **Status page now reads everything from the spreadsheet** (it previously read receipts from a file stored on your own computer, so a new admin's Status page showed zero receipts while the Receipts page correctly showed them). Added an **Invoices issued** tile and column.
- **v0.11.1** — Invoice Issued (column L) is now **two-way** with Excel, matching Receipt Issued: the invoice review screen reads it live and gained a **⟳ Refresh** button + an **Issued** status column, so clearing the cell in Excel and refreshing un-marks it in the app too (previously write-only).
- **v0.11.0** — Column **D** relabelled **POC → School** (admin reference only, phone masking removed); **Adjustment (J/K) → Material Fee**, including the invoice PDF line item; **Invoice Issued (L)** is now stamped **"Yes"** automatically when invoices are exported to the shared folder (previously never written).
- **v0.10.1** — Internal bug-fix release (no admin-facing changes): config/ledger reads no longer crash on a UTF-8 BOM from hand-editing a JSON file in Notepad; fixed a broken local production build.
- **v0.10.0** — Receipt status syncs **both ways** with Excel (edit/clear O or R and the app follows on refresh); write-back only ever touches the selected term tab.
- **v0.9.0** — **Lessons = 0** marks a student "not billed this term" (skipped from the run); a typed `0` finally means zero (blank still = 12). Mid-term joiners handled by lesson count.
- **v0.8.0** — **Term sheet dropdown** on the Invoices and Receipts pages; the list updates as you add tabs.
- **v0.7.0** — Receipt **Preview** button; standard term tabs pre-created; "Adjustment Notes" label.
- **v0.6.0** — Receipt colour fills only its own cell; roster linked down to row 500.
- **v0.5.0** — Material Fee removed; status columns are L–R; the Receipt Issued cell is a red→green light.
- **v0.4.0** — **Master tab** + formula-linked term tabs (type each student once); freezing for closed terms.
