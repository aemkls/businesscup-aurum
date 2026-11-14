# ClaimBack

**Live:** https://businesscup-aurum-delta.vercel.app · test card `4242 4242 4242 4242`, any future date and CVC.

A web app for insured adults in the US who got a hospital bill they do not
understand. ClaimBack reads the bill and the insurer's Explanation of Benefits
(EOB), checks both against the terms of the user's own plan and shows what they
should not be paying. For a one-time payment it writes the dispute letter, the
insurer appeal and a call script, and keeps a follow-up plan with deadlines.

No sign-up, no account, no database. Uploaded files are processed in memory and
never stored; the case lives in the browser's localStorage.

Built for Business Cup 2.0 (Money track) by Yernazarov Gafur (team lead,
backend), Zhaparov Tamerlan (full-stack, interface) and Bekpentbet Daniyal
(market research, payments, deployment).

## Contents

- [Why this exists](#why-this-exists)
- [What the jury can try in two minutes](#what-the-jury-can-try-in-two-minutes)
- [How it works](#how-it-works)
- [What the product does](#what-the-product-does)
- [Pricing and the business](#pricing-and-the-business)
- [Loyalty card: every 4th case is free](#loyalty-card-every-4th-case-is-free)
- [Family plan: $79 a year, unlimited cases](#family-plan-79-a-year-unlimited-cases)
- [First-visit notice](#first-visit-notice)
- [Security and privacy](#security-and-privacy)
- [Tech stack](#tech-stack)
- [Run locally](#run-locally)
- [Environment variables](#environment-variables)
- [Deploy](#deploy-vercel)
- [Project layout](#project-layout)

## Why this exists

About 19% of in-network claims on ACA marketplace plans are denied — roughly
73 million denials a year — yet only about 1 in 200 denials is ever appealed,
although 44% of appeals succeed (KFF analysis of ACA marketplace claims data,
January 2025). People pay bills they do not owe because the bill and the EOB
are written for billing departments, not for patients, and because nobody has
time to learn CPT codes and appeal deadlines.

The features come from real complaints we collected on Reddit and in the
press — a "free" annual physical that turns into a $400+ bill, a summary bill
with no breakdown, a $300+ facility fee for a normal visit, unreadable denial
codes, collectors calling about old bills. Every source is listed in
[`docs/RESEARCH.md`](docs/RESEARCH.md).

## What the jury can try in two minutes

1. Open the [live site](https://businesscup-aurum-delta.vercel.app). You will
   see the loyalty-card notice (close it with "Got it") and a sample hospital
   bill being marked up with a yellow marker and a red pen.
2. Click **Try with a sample bill**: the ER visit ($3,729.80 billed, $2,547.00
   of it wrong) or the "free" annual physical. Or photograph/upload your own
   bill — the same pipeline runs on it.
3. Walk the tabs: What we found, Next steps, Your bill (every error marked on
   the bill itself), Letters, Pay less.
4. Click **Unlock my case for $19** and pay with the Stripe test card
   `4242 4242 4242 4242`. The letters, the appeal and the call script are
   generated only after the server confirms the payment with Stripe. Each
   payment also adds a stamp to the loyalty card.
5. Everything runs without any login.

## How it works

```
photo / PDF ──> AI reader (Gemini) ──> rule engine ──> AI rewording ──> results
                lib/ai/extract.ts      lib/engine/     lib/ai/explain.ts
```

1. **AI reads.** Gemini transcribes the bill and the EOB into typed JSON
   (`lib/ai/schema.ts`), validated with zod. A photo or a PDF takes about 9
   seconds.
2. **Code counts.** Pure TypeScript functions find the problems and compute
   every dollar amount. No AI is involved in the numbers, so the same
   documents always produce the same findings.
3. **AI explains.** Gemini rewrites the findings and the letters in plain
   English. A guard (`lib/ai/guard.ts`) rejects any text that mentions a
   dollar amount the engine did not produce.

### Rules

| Rule | File | Catches |
|------|------|---------|
| `duplicateCharges` | `lib/engine/billRules.ts` | The same line billed twice |
| `quantityAnomaly` | `lib/engine/billRules.ts` | Once-per-visit services billed with quantity > 1 |
| `billVersusEob` | `lib/engine/eobRules.ts` | Balance billing; a bill above the EOB patient share |
| `planMath` | `lib/engine/planMath.ts` | Deductible, coinsurance or out-of-pocket max applied wrongly |
| `deniedClaims` | `lib/engine/eobRules.ts` | Denied lines the patient can appeal |
| `preventiveCare` | `lib/engine/preventive.ts` | Preventive visits and screenings billed as paid care |

### Reliability

Free-tier Gemini models answer 429/503 under load. `lib/ai/client.ts` retries
with backoff and falls back across models; the letters request retries once
and the UI offers "Try again" instead of a dead end. If the AI is still
unavailable, the sample case loads its documents from `data/samples` and the
engine runs as usual; the results page says so. 135 automated tests cover the
engine, the payments, the loyalty card and the family plan.

## What the product does

- **Free check.** The findings, the marked-up bill and the total you may not
  owe are always free. You see the value before you pay.
- **Paid case ($19, one time).** A dispute letter to the provider, an appeal
  to the insurer, a phone script, and extra letters where they apply: an
  itemized-bill request, a facility-fee dispute (20+ states limit the fee by
  law), a Good Faith Estimate dispute (bills $400+ over the estimate), a debt
  validation request for collectors (30-day window), and a denial decoder
  with the 180-day appeal deadline.
- **Next steps.** A plan with dates: what to send, when to call, when to
  follow up (14 and 30 days), exportable to the calendar (.ics).
- **Case tracker.** The case is stored in the browser; coming back shows
  where you left off.
- **Pay less.** A financial-assistance check against 2026 federal poverty
  guidelines: many nonprofit hospitals must write off or discount bills below
  certain income levels.

## Pricing and the business

- **$19 per case.** Less than 1% of the overcharge found on the demo bill.
  One payment opens one case: at the first unlock the server writes a hash of
  the bill (`lib/caseHash.ts`) into the payment's metadata in Stripe, and the
  same payment then opens only that bill. A different bill answers 402 with a
  clear message. Reloads and reopening the same case keep working.
- **$79 a year, family plan.** Unlimited cases for up to 5 devices — see
  below. Renews through Stripe; two years of a family plan is $158 from one
  customer.
- **Why people come back.** The follow-up plan brings them back at 14 and 30
  days, every new bill is a new case, and the loyalty card makes the 4th case
  free. Unit economics (estimates): CAC $3–8 on organic channels (SEO for
  queries like "hospital bill too high", Reddit threads where these people
  already are), LTV $38 from two cases or $79+/year from a family plan.

## Loyalty card: every 4th case is free

**The terms, as the user sees them:** pay for 3 cases with the same card in
the same browser, and the 4th case unlocks for $0. To claim it you confirm the
same card in a $0 Stripe form; nothing is charged. Apple Pay and other wallets
may not count — type the card number.

**How it works without accounts or a database.** The card is split in two:

- The stamps live in the browser, in an httpOnly cookie signed with
  `LOYALTY_SECRET` (session id, PaymentIntent id and card fingerprint; one
  stamp per Checkout session, a payment with a different card restarts the
  card).
- The redemption marks live in Stripe, in the metadata of the stamped
  PaymentIntents.

With 3 stamps the free case opens through a $0 Stripe Checkout in setup mode.
The server checks the cookie signature, that each stamped session is really
paid, that none of the payments was redeemed before, and that the confirmed
card has the same fingerprint as all 3 payments. Only then it marks the
payments `loyalty_redeemed` in Stripe, empties the card and issues a signed
one-time free pass that `/api/letters` accepts once.

A copied cookie is useless without the card; the card alone is useless without
the cookie (in test mode every 4242 card shares one fingerprint, so neither
half may stand alone); a replayed pass is spent. Logic and tests:
`lib/loyalty.ts`.

## Family plan: $79 a year, unlimited cases

**Why it exists.** Medical bills come to households, not individuals: one ER
visit produces bills for the whole family, and open-enrollment questions
return every year. A yearly plan turns a one-time $19 customer into a
renewing one and gives the household one shared answer.

**What the user gets.** Unlimited cases on up to 5 devices for a year,
cancellation any time through Stripe's own billing portal.

**How it works, again without accounts.** The plan lives in Stripe: the
subscription itself, the device count and used invite links in the
subscription's metadata, the card fingerprint in the customer's metadata.
Each device holds a signed `cb_family` cookie carrying `purpose: "family"`,
so loyalty and family tokens can never be swapped for each other.

- **Access.** `/api/letters` checks, in order: an active family plan (the
  server asks Stripe on every request; only `active` or `trialing` opens a
  case), then a paid $19 session bound to the bill, then the loyalty free
  pass, otherwise 402. A canceled or unpaid plan closes access at once.
- **Family members.** The buyer generates a one-time invite link (signed,
  7-day expiry) from the "Family plan active" plate; the link is opened at
  `/family/join`. Up to 5 devices; each link works once.
- **Restore.** "I have a family plan" runs a $0 card check; the server finds
  the plan by the card's fingerprint and does not spend a device slot. This
  also covers a cleared browser.
- **Manage.** "Manage subscription" opens Stripe's billing portal (cancel,
  change the card). Only the buyer's devices see invites and the portal — a
  family member cannot cancel the plan or see payment details.

Logic and tests: `lib/family.ts`, `lib/lettersAccess.ts`.

## First-visit notice

On the first visit the site shows a centered dialog over a dimmed page: four
stamp circles (the 4th marked **$0 / Free**), the heading "Every 4th case is
free", the loyalty terms and a "Got it" button. It closes with the button, the
cross, Esc or a click outside, remembers the choice in localStorage and never
returns. It is accessible (focus trap, `role="dialog"`, reduced-motion
support) and is not shown on the return from a payment, so it never covers
the "Stamp N of 3 added" toast or the letters. When payments or the loyalty
card are off, the dialog is off too.

## Security and privacy

- No accounts and no database anywhere in the product.
- Files are processed in memory and never stored; the case stays in the
  user's browser.
- All money amounts come from the deterministic engine, never from the model.
- Paid content is generated only after the server confirms the payment (or
  the plan, or the free pass) with Stripe; without one the API answers 402.
- Payment pages are Stripe's own; the app never sees card numbers, only
  Stripe's card fingerprint.
- Cookies are httpOnly, signed (HMAC-SHA256, constant-time comparison) and
  purpose-tagged.
- ClaimBack is software, not a law firm: it gives templates and math, the
  person decides. We are not a HIPAA-covered entity; we orient on the FTC
  Health Breach Notification Rule.

## Tech stack

Written in **TypeScript**. Next.js 16 (App Router) on Vercel, Tailwind CSS 4,
zod 4 for schemas, `@google/genai` (Gemini) for reading documents and wording
text, Stripe Checkout for payments (no webhooks: the server verifies sessions
and subscriptions directly), vitest for the 135 tests, Playwright for the
end-to-end runs. The interface language is English; the product targets US
patients.

## Run locally

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY
npm run dev
```

```bash
npm test          # unit tests (engine, payments, loyalty, family)
npm run typecheck
npm run lint
```

Without `STRIPE_SECRET_KEY` the app runs in demo mode: the unlock is free and
the loyalty card and family plan are hidden.

## Environment variables

| Name | Required | What it is |
|---|---|---|
| `GEMINI_API_KEY` | yes | Google AI Studio key. Server-side only. |
| `GEMINI_MODEL` | no | Model tried first. Default order: `gemini-3.5-flash`, `gemini-3.1-flash-lite`, then the `-latest` aliases. |
| `STRIPE_SECRET_KEY` | no | Stripe **test** key `sk_test_...`. Without it the unlock runs in demo mode (free). With it, one payment opens one bill (`lib/caseHash.ts`, `unlockPaidCase` in `lib/payments.ts`). |
| `STRIPE_PRICE_ID` | no | A Price from the Stripe dashboard. Without it Checkout charges an inline $19. |
| `LOYALTY_SECRET` | no | Signs the loyalty card and family plan cookies (`openssl rand -hex 32`). Without it, or without `STRIPE_SECRET_KEY`, both are off. |
| `STRIPE_FAMILY_PRICE_ID` | no | The family plan's yearly Price (`price_...`, $79/year). Without it the family plan is off and not shown. |

## Try the upload path

`public/samples/` has the sample case as real documents (bill photo, bill
PDF, EOB PDF), linked from the upload step, and `docs/test-files/` holds
more test documents with an answer key. Regenerate the samples with
`node scripts/render-sample-docs.mjs`.

## Deploy (Vercel)

Import the repository at vercel.com/new with default settings, then add the
variables from `.env.example` under Settings → Environment Variables and
redeploy. Payments use Stripe Checkout in test mode: card `4242 4242 4242 4242`.

## Project layout

```
app/              pages (landing, check, results, case, family/join) and API routes (analyze, checkout, letters, loyalty, family)
components/       client components; components/results/ holds the results tabs
components/ui.tsx buttons, bands, cards and chips from docs/DESIGN.md
lib/engine/       deterministic rules + tests (all dollar amounts come from here)
lib/ai/           Gemini client, extraction, rewording, number guard
lib/letters/      letter templates and filling in personal details (+ tests)
lib/loyalty.ts    loyalty card: signed stamps, redemption checks (+ tests)
lib/family.ts     family plan: activation, access, invites, restore (+ tests)
lib/lettersAccess.ts  who may open a case, in which order (+ tests)
lib/caseHash.ts   one payment = one bill (+ tests)
lib/tracker.ts    follow-up plan, dates counted from sending, .ics export (+ tests)
data/samples/     synthetic sample case and its answer key
docs/             SPEC.md (product), DESIGN.md (design system), RESEARCH.md (sources)
```

ClaimBack is software, not a law firm. It does not give legal or medical advice.
