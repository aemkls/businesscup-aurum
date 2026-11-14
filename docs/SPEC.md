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

1. **Landing.** One claim, two actions: "Check my bill", "Try with a sample bill".
   Shows "You have an open case" when this browser has one.
2. **Check.** Plan terms (deductible, deductible met, coinsurance,
   out-of-pocket max and met, network) and the documents (bill required, EOB
   optional).
3. **Results (free).** Headline amount, billed vs fair amount, each finding
   with amount, confidence, who to contact and the evidence.
4. **Unlock.** $19 one-time through Stripe Checkout.
5. **Documents (paid).** Dispute letter, insurer appeal, call script.
6. **Follow-up plan (paid).** Steps with due dates, progress saved locally,
   calendar export (.ics).

## Why they come back

A dispute takes weeks. The follow-up plan gives dated next steps (day 14 call,
day 30 escalation, appeal deadline) and the calendar file brings the user back
to the case on those dates.

## Roadmap

- Plan chooser for open enrollment on the same plan-math engine.
- Family plan: several members and bills under one yearly price.
- Reading the plan terms from the Summary of Benefits and Coverage.
