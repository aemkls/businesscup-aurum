# What patients struggle with, and what ClaimBack does about it

We read patient threads (r/HealthInsurance, r/HospitalBills, r/MedicalBill,
r/personalfinance) and reporting on them, and turned the most repeated
problems into checks. Each row links a problem to the feature that answers it.

| Problem patients describe | What ClaimBack does | Where in the code |
|---|---|---|
| A "free" annual physical comes back with a copay, or labs billed as diagnostic ($400+ for a physical on r/HealthInsurance; a $1,430 checkup reported by KFF Health News) | **Preventive care guard**: flags cost sharing on in-network preventive visits and screenings, and screening labs billed without a screening diagnosis | `lib/engine/preventive.ts` |
| A question asked during the physical turns it into two visits | **Split visit check**: flags a problem visit billed the same day as a physical as "worth asking", without counting it as money back | `lib/engine/preventive.ts` |
| Hospitals send a summary bill; the most repeated advice is "ask for the itemized bill" (one patient cut $1,100 to $618 that way) | **Itemized bill gate**: detects a summary bill and gives the request letter, citing the HIPAA right of access | `lib/features/actions.ts`, `extraLetters.ts` |
| Denials patients don't understand: coordination of benefits, prior authorization, timely filing, coding | **Denial decoder**: turns the denial reason into what it means, who can fix it and the fastest fix, often a call or a corrected claim instead of an appeal | `lib/features/denials.ts` |
| A $250–$800 "facility fee" for a visit to what looked like a regular doctor's office (InvestigateTV "Costly Care", 2026) | **Facility fee spotlight**: finds hospital outpatient clinic fees and gives a review letter; more than 20 states regulate them | `lib/features/actions.ts` |
| A bill sent to collections that the patient never saw, or before insurance was billed | **Never-billed detector** and **collections shield**: debt validation letter within 30 days, recall request, and the credit bureaus' current rules (under $500 not reported, paid removed, one-year wait) | `lib/features/actions.ts` |
| Uninsured patients billed far above the estimate | **Good Faith Estimate check**: at $400 or more above the estimate, the federal patient-provider dispute, with the 120-day deadline | `lib/features/actions.ts` |
| Not knowing deadlines | **Deadline radar**: appeal (180 days), federal dispute (120 days), debt validation (30 days) on the plan and in the calendar file | `lib/features/actions.ts`, `lib/tracker.ts` |
| Moving medical debt to a credit card or a deferred-interest medical card | **Pay the right way**: pay the undisputed part, interest-free plans, avoid deferred interest | `lib/features/actions.ts` |
| Not knowing hospitals must offer financial assistance | **Charity care check** against the 2026 federal poverty guidelines | `lib/engine/assistance.ts` |

## Samples

- `data/samples/sample.ts`: ER visit, five billing errors, $2,547.00.
- `data/samples/physical.ts`: a "free" annual physical billed $407: a copay
  on the preventive visit, a cholesterol screening billed as diagnostic, a
  split visit and a $240 hospital facility fee.

## Sources

- KFF Health News, "The Patient Expected a Free Checkup. The Bill Was $1,430" (2025).
- r/HealthInsurance, "Aetna is charging me $400+ for 'free' annual physical" (Dec 2024).
- Upworthy, on a Reddit post: an itemized bill cut $1,100 to $618 (2026).
- InvestigateTV "Costly Care" series on hospital facility fees (July and September 2026).
- CMS, Good Faith Estimate and patient-provider dispute resolution guidance.
- CFPB and Equifax on medical debt and credit reports (paid and under-$500 medical collections not reported).
