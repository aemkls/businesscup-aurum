# Sample case (synthetic)

`sample.ts` is an invented emergency-room visit: an itemized hospital bill, the
insurer's EOB for the same visit and the patient's plan terms. Nothing in it
belongs to a real person or organization.

The bill asks for **$3,729.80**. Five problems are planted:

| # | Problem | Who to contact | Amount |
|---|---------|----------------|--------|
| 1 | CT head (70450) billed twice, insurer processed one | Hospital | $1,420.00 |
| 2 | Venipuncture (36415) quantity 10, insurer was billed for 1 | Hospital | $225.00 |
| 3 | ECG (93005): hospital did not write off the insurer discount ($210 billed, $48 allowed) | Hospital | $162.00 |
| 4 | Insurer applied the full $1,500 deductible although $500 was already met | Insurer | $400.00 |
| 5 | Chest X-ray (71046) denied as "not medically necessary" | Insurer (appeal) | $340.00 |

Total: **$2,547.00**. Fair amount if everything is corrected: **$1,182.80**.

This table is the answer key for `lib/engine/engine.test.ts`. The app itself
never reads it: the numbers on screen come from the rule engine.

## Downloadable documents

`public/samples/` has the same case rendered as real documents, to test the
upload path end to end: `sample-bill.pdf`, `sample-bill.jpg` (a phone-style
photo) and `sample-eob.pdf`. Regenerate them after editing `sample.ts`:

```bash
node scripts/render-sample-docs.mjs
```
