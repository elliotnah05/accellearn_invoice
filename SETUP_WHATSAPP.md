# WhatsApp Cloud API Setup — AccelLearn Invoice App

This guide takes you from zero to sending invoice PDFs to parents via WhatsApp.
The code is already built — you only need to get credentials from Meta and paste
them into `app/.env.local`.

---

## Part 1 — Create the Meta app (~15 min)

1. Go to **https://developers.facebook.com** and log in with the Facebook
   account that manages (or will manage) the AccelLearn business.
2. **My Apps → Create App** → choose **Business** as the app type.
3. Name it (e.g. `AccelLearn Invoicing`), select or create your
   **Meta Business Portfolio** when prompted.
4. On the app dashboard, find **WhatsApp** in the product list and click
   **Set up**. This auto-creates a **WhatsApp Business Account (WABA)**.

## Part 2 — Get the 3 credentials

Go to **WhatsApp → API Setup** in the left sidebar of your app. You'll see:

| Credential | Where it is | Paste into `.env.local` as |
|---|---|---|
| Temporary access token | Top of the API Setup page (valid 24h) | `WHATSAPP_ACCESS_TOKEN` |
| Phone Number ID | Under "Send and receive messages" → From | `WHATSAPP_PHONE_NUMBER_ID` |
| WhatsApp Business Account ID | Same page, below Phone Number ID | `WHATSAPP_BUSINESS_ACCOUNT_ID` |

⚠️ **Phone Number ID is NOT the phone number** — it's a long numeric ID.

Then **restart the dev server** (`Ctrl+C`, `npm run dev`) — Next.js only reads
`.env.local` at startup.

### Testing mode (start here)
Meta gives you a **free test sender number** immediately. Limitations:
- You can only send to **up to 5 verified recipient numbers** — add your own
  phone under "To" → **Manage phone number list** and verify via the code sent.
- The temporary token **expires after 24 hours** (regenerate on the same page).

This is perfect for testing with your own number before going live.

### Going live (when testing is done)
1. **Business verification**: Business Settings → Security Centre → Start
   Verification (needs ACRA docs / proof of AccelLearn's registration).
2. **Add your real sending number**: WhatsApp → API Setup → Add phone number.
   ⚠️ A number can't be on the WhatsApp/WhatsApp Business *app* and Cloud API
   at the same time — use a dedicated business number if possible.
3. **Permanent access token**: Business Settings → Users → **System Users** →
   Add (Admin role) → Assign the app with full control → **Generate Token**
   with permissions `whatsapp_business_messaging` + `whatsapp_business_management`.
   Replace the temporary token in `.env.local` with this one — it never expires.

## Part 3 — Create the invoice message template (required for live sends)

WhatsApp only lets a business **start** a conversation using a pre-approved
template. (Free-form messages are allowed only within 24h of the parent
messaging you first.)

1. Go to **https://business.facebook.com/wa/manage/message-templates**
   (WhatsApp Manager → Message templates) → **Create template**.
2. Settings:
   - **Category**: Utility
   - **Name**: `invoice_notice`  ← must match `WHATSAPP_TEMPLATE_NAME` in `.env.local`
   - **Language**: English  (`en`)
3. **Header**: choose **Document** (this is where the PDF attaches).
4. **Body** — must use exactly 4 variables, in this order:

   ```
   Dear {{1}},

   Please find attached the AccelLearn tuition invoice for {{2}} — {{3}}.

   Amount due: {{4}}
   Payment via PayNow (UEN in the invoice). Kindly reply to this message once paid.

   Thank you for your continued support!
   ```

   The app fills them as: `{{1}}` parent name · `{{2}}` student name ·
   `{{3}}` subject (level) · `{{4}}` total amount.
5. Submit. Utility templates are usually **approved within minutes to a few
   hours**. Check status in WhatsApp Manager.

> While waiting for approval you can still test: leave
> `WHATSAPP_TEMPLATE_NAME=` **empty** in `.env.local` and message the test
> number from your phone first — that opens a 24h window in which the app can
> send the PDF as a plain document message.

## Part 4 — Send

1. `npm run dev` → **Import** → **Review & Approve** → **Proceed to Send**.
2. The `/send` page shows a green "WhatsApp connected" banner when credentials
   are detected.
3. **Send** per student, or **📲 Send All** (paced 1/sec). Failed sends show the
   reason inline and can be retried.

## Costs (Singapore, as of setup)

- Utility template conversations are charged per 24h conversation window
  (roughly a few cents SGD each). First 1,000 service conversations/month free.
- Add a payment method in Business Settings → Billing before going live,
  or sends will fail once past the free tier.

## PDPA notes (built into the app)

- PDFs are generated **in memory only** and uploaded straight to Meta —
  nothing is written to disk, nothing retained after delivery.
- Server logs never contain names or phone numbers (only serial numbers).
- Numbers are masked in the UI.
- `.env.local` is gitignored — credentials never leave this machine.
- ✅ **Your responsibility**: ensure parents have consented to receiving
  invoices via WhatsApp (a line in your enrolment form is sufficient).

## Troubleshooting

| Error on /send page | Fix |
|---|---|
| "Access token expired (code 190)" | Temporary token lasts 24h — regenerate, or create a permanent System User token |
| "Outside 24h session window (code 131047)" | Set up the approved template (Part 3) |
| "Template not found (code 132001)" | Name/language in `.env.local` must exactly match the approved template |
| "Message undeliverable (code 131026)" | Number not on WhatsApp, or recipient not in your test list (testing mode) |
| "WhatsApp not configured" banner | Fill `.env.local`, then **restart** `npm run dev` |
