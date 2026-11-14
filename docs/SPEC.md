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

The visual language is in [`DESIGN.md`](DESIGN.md): "audit on paper". The
bill is a sheet of paper on a desk, marked up with a yellow marker and a red
pen; everything else stays calm.

### 1. Landing `/`

- Headline "Hospital bills are full of mistakes. We find yours." next to the
  sample bill as paper. On load, one ~3 s scene marks it up: marker on the
  problem lines, pen strikes the duplicate CT, corrects qty 10 to 1, writes
  margin notes, strikes $3,729.80 and writes $1,182.80. The marks come from
  the rule engine run on the sample case.
- Primary **Try with a sample bill** (`/check?sample=er`), secondary **Check my bill**,
  and a choice of the two samples: ER visit or a "free" annual physical
  (`/check?sample=physical`). The hero always shows the ER bill.
- Three steps, then three KFF numbers with the source.
- "You have an open case" line in the hero when this browser has one.

### 2. Check `/check`, step 1 of 2: "Your bill"

- The upload comes first, so "Check my bill" opens on it. Itemized bill,
  required (Continue asks for it); EOB, optional. Photo (JPG, PNG, WebP, HEIC) or
  PDF up to 10 MB, click or drag and drop.
- Links to download a sample bill (photo, PDF) and EOB to try a real upload.
- In sample mode: the sample bill and EOB as text, and the ER visit /
  annual physical switch.

### 3. Check `/check`, step 2 of 2: "Your plan"

| Field | Notes |
|---|---|
| Annual deductible | $ |
| Deductible paid this year | $, before this visit |
| Coinsurance | %, patient share after the deductible |
| Out-of-pocket maximum | $ |
| Out-of-pocket paid this year | $, before this visit |
| Copay for this visit | $, 0 if none |
| Network | In-network / Out-of-network |

- Thin progress bar, step counter. The fields sit on a health plan card.
- A "?" next to every field answers "Where do I find this?" (plan summary,
  insurer portal, insurance card).
- **Fill from sample**; the form is remembered in `localStorage`; inline
  validation (e.g. deductible paid cannot exceed the deductible).
- **Run the check** sends the files and the plan. While it runs: a vertical
  list of steps that tick off. If the AI reader is overloaded (503): a plain
  message, **Try again**, and a link to the sample.

### 4. Results `/results`

- Head: "$X you may not owe", "Billed → If corrected", and one action:
  **Unlock my case for $19** before payment, **Send your letters** after it.
  Next to it the user's own bill as paper, marked up from the findings, once.
- Folder tabs on the case file (`?tab=` in the URL, arrow keys):
  1. **What we found**: one row per finding with amount, confidence word
     (High / Medium / Low), who to contact and a plain explanation; evidence
     collapsed behind "Show evidence"; "See it on your bill".
  2. **Next steps**: the action plan from `lib/features/actions.ts` (denial
     decoder, facility fee, itemized bill, collections, Good Faith Estimate,
     how to pay), with three questions the documents cannot answer. Deadlines
     show as "Due <date>"; the extra letters unlock with the case.
  3. **Your bill**: the bill line by line, flagged lines marked. Selecting a
     finding highlights its lines; clicking a flagged line selects its
     finding (`&finding=` in the URL).
  4. **Letters**: before payment a blurred preview and the offer; after it a
     personal details form, then the letters with Copy, Download .txt,
     Print / save PDF, and Download all.
  5. **Pay less**: financial assistance screening against the 2026 federal
     poverty guidelines; answers stay on the device.
- Empty states: no case in this browser; no EOB (note and "Run again with
  the EOB"); nothing found ("Your bill looks right" and the Pay less tab).

### 5. Unlock

- `POST /api/checkout` creates a Stripe Checkout session in **test mode**,
  **$19 one time per bill**. Test card `4242 4242 4242 4242`.
- Back on `/results?session_id=…`, `POST /api/letters` checks with Stripe
  that the session is paid, recomputes the findings and only then writes the
  letters. Without `STRIPE_SECRET_KEY` the deployment runs in demo mode.
- **One payment = one case.** The first time a paid session opens letters,
  the bill's fingerprint (`caseHash`: provider, statement date, lines, amount
  due) is written to the PaymentIntent's metadata (`case_hash`). The same
  session reopens that bill any time; another bill gets 402 `other_case`, and
  the results show that case's own paywall with "Your last payment unlocked a
  different bill. This one is a new case."
- **Loyalty card: every 4th case is free.** On the first visit a centered
  dialog over the dimmed page explains it (4 stamps, the 4th "$0 / Free");
  "Got it", ×, Esc or a click outside closes it for good. Not shown on the
  return from a payment. Next to the pay button: 4 stamp circles, the
  4th marked Free, and the terms (same card, same browser; wallets may not
  count). Each paid case adds a stamp ("Stamp 2 of 3 added"); with 3 the
  button turns into **Unlock free with your loyalty card**, a $0 Stripe setup
  checkout where the user confirms the same card. The server decides; the
  stamps live in a signed cookie, the redemption marks in Stripe metadata.
  Off without `LOYALTY_SECRET` or in demo mode.
- **Family plan: $79/year, unlimited cases for your household.** The second
  option under the $19 button ("Cancel anytime. Up to 5 devices.") with "I
  have a family plan" next to it. Bought through Stripe Checkout in
  subscription mode; back on `/results?family_session=…` the plan is put on
  the browser ("Family plan active. Every case is unlocked."). On a device
  with an active plan the paywall and the loyalty card are replaced by a
  "Family plan active" plate (devices "2 of 5"), and the letters of every case
  open at once. The buyer's devices can "Add a family member" (a one-time
  link for 7 days, `/family/join`, Copy link) and "Manage subscription"
  (Stripe's portal). "I have a family plan" restores it with the same card in
  a $0 card check, without using a device slot. A canceled or unpaid plan
  closes access at once. Off without `STRIPE_FAMILY_PRICE_ID`,
  `LOYALTY_SECRET` or `STRIPE_SECRET_KEY`.
- Personal details (name, address, phone or email, hospital account number,
  member ID) are filled into the letters in the browser and stored only in
  `localStorage`. Printing shows only the letters, one per page.

### 6. My case `/case`

- A case file folder: summary (provider, billed, in dispute), progress bar,
  timeline of steps.
- **Mark as sent** stamps the letter SENT with the date; follow-up deadlines (day 14
  call, day 30 escalation, appeal deadline) count from that date.
- **Add reminders to my calendar** downloads an `.ics` file with the same dates.

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
