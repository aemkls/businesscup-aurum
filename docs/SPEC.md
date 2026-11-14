# ClaimBack product spec

## User and pain

A working adult in the US, 25 to 45, insured through an employer or the
marketplace, who received a hospital bill for a few thousand dollars. They
cannot tell whether it is right, and almost nobody disputes: about 1 in 200
denied claims is appealed, although 44% of appeals succeed (KFF, 2023 data).

## Promise

In two minutes, without an account: what on this bill you should not owe,
why, and the documents to get it fixed.

## Principles

- The numbers come from code. AI reads documents and words explanations; the
  rule engine decides what is wrong and how much.
- Nothing is stored server-side. The case lives in the user's browser.
- One user, one pain. No dashboards, no accounts, no settings.
- Software, not legal advice. Letters are written in the patient's own name.

## Screens

### 1. Landing `/`

- One claim: "Your hospital bill is probably wrong. Find out by how much."
- Two actions: **Check my bill** (`/check`) and **Try with a sample bill**
  (`/check?sample=1`).
- "You have an open case" banner when this browser already has one.

### 2. Check `/check`: step 1 "Your plan"

| Field | Notes |
|---|---|
| Annual deductible | $ |
| Deductible already paid this year | $, before this visit |
| Coinsurance | %, patient share after the deductible |
| Out-of-pocket maximum | $ |
| Out-of-pocket already paid this year | $, before this visit |
| Copay for this visit | $, 0 if none |
| Network | In-network / Out-of-network |

- **Fill from sample** fills the form with the sample plan.
- The form is remembered in `localStorage`; the server validates it with zod.

### 3. Check `/check`: step 2 "Upload"

- Itemized bill, required: photo (JPG, PNG, WebP, HEIC) or PDF, up to 10 MB.
- EOB, optional, same formats. Without it only bill-only rules run.
- Links to download a sample bill (photo, PDF) and EOB to try a real upload.
- Files go to `POST /api/analyze` in memory and are never stored.
- In sample mode the documents are shown as text and still go through the
  same AI reader and rule engine.

### 4. Results `/results` (free)

- Headline: **"$X likely overcharged"**, then billed / in dispute / fair amount.
- One card per finding: type, amount, confidence **High / Medium / Low**,
  who to contact (hospital or insurer), plain-English explanation, evidence
  from the documents.
- The bill line by line, with flagged lines marked.
- Financial assistance check (household size and income, kept on the device).
- Paywall: the dispute letter and call script are shown **blurred**. The
  teaser is built only from data already on the page; the real documents are
  generated on the server after payment.

### 5. Unlock

- `POST /api/checkout` creates a Stripe Checkout session in **test mode**,
  **$19 one time per bill**. Test card `4242 4242 4242 4242`.
- Stripe redirects back to `/results?session_id=…`; `POST /api/letters`
  checks with Stripe that the session is paid, recomputes the findings from
  the documents and returns the dispute letter, insurer appeal and call script.
- Without `STRIPE_SECRET_KEY` the deployment runs in demo mode and unlocks
  without a charge.

### 6. My case `/case`

- Case tracker stored in `localStorage`: provider, billed, in dispute.
- Timeline of steps with due dates (send letter, file appeal, day-14 call,
  day-30 escalation, appeal deadline), ticked off and saved locally.
- **Add these dates to my calendar** downloads an `.ics` file with reminders.

## Data and logic

- Types: `lib/types.ts` (`PlanInfo`, `BillLineItem`, `Bill`, `EobLine`,
  `Eob`, `Finding`, `AnalysisResult`).
- AI (`lib/ai/`): Gemini Flash transcribes documents to JSON and rewords
  explanations and letters. A guard rejects AI text with dollar amounts the
  engine did not produce.
- Rules (`lib/engine/`): pure functions, unit-tested against the sample case
  in `data/samples/`, whose planted errors are listed in its README.

## Why they come back

A dispute takes weeks. The follow-up plan gives dated next steps (day 14 call,
day 30 escalation, appeal deadline) and the calendar file brings the user back
to the case on those dates.

## Roadmap

- Plan chooser for open enrollment on the same plan-math engine.
- Family plan: several members and bills under one yearly price.
- Reading the plan terms from the Summary of Benefits and Coverage.
