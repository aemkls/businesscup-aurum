# ClaimBack

A web app for insured adults in the US who got a hospital bill they do not
understand. ClaimBack reads the bill and the insurer's Explanation of Benefits
(EOB), checks both against the terms of the user's own plan and shows what they
should not be paying. For a one-time payment it writes the dispute letter, the
insurer appeal and a call script, and keeps a follow-up plan with deadlines.

No sign-up. Uploaded files are processed in memory and never stored. The case
is kept in the browser's localStorage.

## How it works

```
photo / PDF ──> AI reader (Gemini) ──> rule engine ──> AI rewording ──> results
                lib/ai/extract.ts      lib/engine/     lib/ai/explain.ts
```

1. **AI reader.** Gemini transcribes the documents into typed JSON
   (`lib/ai/schema.ts`), validated with zod.
2. **Rule engine.** Pure TypeScript functions find the problems and compute
   every dollar amount. No AI is involved in the numbers.
3. **AI rewording.** Gemini rewrites the explanations and letters in plain
   English. A guard (`lib/ai/guard.ts`) rejects any text that mentions a dollar
   amount the engine did not produce.

### Rules

| Rule | File | Catches |
|------|------|---------|
| `duplicateCharges` | `lib/engine/billRules.ts` | The same line billed twice |
| `quantityAnomaly` | `lib/engine/billRules.ts` | Once-per-visit services billed with quantity > 1 |
| `billVersusEob` | `lib/engine/eobRules.ts` | Balance billing; a bill above the EOB patient share |
| `planMath` | `lib/engine/planMath.ts` | Deductible, coinsurance or out-of-pocket max applied wrongly |
| `deniedClaims` | `lib/engine/eobRules.ts` | Denied lines the patient can appeal |

### Reliability

Free-tier Gemini models answer 429/503 under load. `lib/ai/client.ts` retries
with backoff and falls back across models. If the AI is still unavailable, the
sample case loads its documents from `data/samples` and the engine runs as
usual; the results page says so.

## Run locally

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY
npm run dev
```

```bash
npm test          # engine unit tests
npm run typecheck
npm run lint
```

## Environment variables

| Name | Required | What it is |
|---|---|---|
| `GEMINI_API_KEY` | yes | Google AI Studio key. Server-side only. |
| `GEMINI_MODEL` | no | Model tried first. Default order: `gemini-3.5-flash`, `gemini-3.1-flash-lite`, then the `-latest` aliases. |
| `STRIPE_SECRET_KEY` | no | Stripe **test** key `sk_test_...`. Without it the unlock runs in demo mode (free). With it, one payment opens one bill: the bill's hash is stored in the PaymentIntent metadata (`lib/caseHash.ts`, `unlockPaidCase` in `lib/payments.ts`). |
| `STRIPE_PRICE_ID` | no | A Price from the Stripe dashboard. Without it Checkout charges an inline $19. |
| `LOYALTY_SECRET` | no | Signs the loyalty card cookie (`openssl rand -hex 32`). Without it, or without `STRIPE_SECRET_KEY`, the loyalty card is off. |

## Loyalty card: every 4th case is free

No accounts and no database, so the card is split in two. Each paid Checkout
session stamps an httpOnly cookie signed with `LOYALTY_SECRET` (session id,
PaymentIntent id, card fingerprint; one stamp per session). With 3 stamps the
4th case opens through a $0 Stripe Checkout in setup mode: the server checks
the signature, that each stamped session is paid, that none of their
PaymentIntents carries `metadata.loyalty_redeemed`, and that the confirmed
card has the same fingerprint as all 3 payments. Then it marks the 3
PaymentIntents as redeemed in Stripe, empties the card and issues a signed
free pass that `/api/letters` accepts once. Logic and tests: `lib/loyalty.ts`.

## Try the upload path

`public/samples/` has the sample case as real documents (bill photo, bill
PDF, EOB PDF), linked from the upload step. Regenerate them with
`node scripts/render-sample-docs.mjs`.

## Deploy (Vercel)

Import the repository at vercel.com/new with default settings, then add the
variables from `.env.example` under Settings → Environment Variables and
redeploy. Payments use Stripe Checkout in test mode: card `4242 4242 4242 4242`.

## Project layout

```
app/              pages (landing, check, results, case) and API routes (analyze, checkout, letters, loyalty)
components/       client components; components/results/ holds the results tabs
components/ui.tsx buttons, bands, cards and chips from docs/DESIGN.md
lib/engine/       deterministic rules + tests (all dollar amounts come from here)
lib/ai/           Gemini client, extraction, rewording, number guard
lib/letters/      letter templates and filling in personal details (+ tests)
lib/tracker.ts    follow-up plan, dates counted from sending, .ics export (+ tests)
data/samples/     synthetic sample case and its answer key
docs/             SPEC.md (product), DESIGN.md (design system)
```

ClaimBack is software, not a law firm. It does not give legal or medical advice.
