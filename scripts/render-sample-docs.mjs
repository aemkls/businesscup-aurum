/**
 * Renders the synthetic sample case (data/samples/sample.ts) as the documents
 * a patient would actually receive: a PDF and a phone-style photo of the
 * itemized bill, and a PDF of the EOB. They live in public/samples/ so anyone
 * can download them and test the real upload path.
 *
 *   node scripts/render-sample-docs.mjs
 *
 * Requires Node 22.18+ (TypeScript type stripping) and Playwright with
 * Chromium, local or global (NODE_PATH="$(npm root -g)" for a global install).
 */
import { createRequire } from "node:module";
import { sampleBill, sampleEob, samplePlan } from "../data/samples/sample.ts";

// require() honors NODE_PATH, so a globally installed Playwright works too.
const { chromium } = createRequire(import.meta.url)("playwright");

const OUT = new URL("../public/samples/", import.meta.url).pathname;
const usd = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const style = `
  body { font-family: Helvetica, Arial, sans-serif; color: #111; margin: 40px; font-size: 12px; }
  h1 { font-size: 18px; margin: 0; } h2 { font-size: 13px; margin: 24px 0 8px; }
  .muted { color: #555; } table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border-bottom: 1px solid #ccc; padding: 5px 6px; text-align: left; }
  th { background: #eee; font-size: 11px; } td.n, th.n { text-align: right; }
  .totals td { border: none; } .due td { font-weight: bold; font-size: 14px; border-top: 2px solid #111; }
  .box { border: 1px solid #111; padding: 10px; margin-top: 16px; }`;

function billHtml() {
  const rows = sampleBill.lines
    .map(
      (l) =>
        `<tr><td>${l.date}</td><td>${l.code}</td><td>${l.description}</td><td class="n">${l.quantity}</td><td class="n">${usd(l.charge)}</td></tr>`,
    )
    .join("");
  return `<html><head><style>${style}</style></head><body>
    <h1>${sampleBill.provider}</h1>
    <div class="muted">1200 Lakeview Drive, Springfield, ST 00000 &middot; Patient Billing (555) 010-0199</div>
    <h2>ITEMIZED PATIENT STATEMENT</h2>
    <div>Patient: Jordan Sample &middot; Account: LRM-000000 &middot; Statement date: ${sampleBill.statementDate}</div>
    <div>Visit: Emergency Department &middot; Insurance: ${sampleEob.insurer}</div>
    <table><tr><th>Date</th><th>Code</th><th>Description</th><th class="n">Qty</th><th class="n">Charge</th></tr>${rows}</table>
    <table class="totals">
      <tr><td>Total charges</td><td class="n">${usd(sampleBill.totalCharges)}</td></tr>
      <tr><td>Insurance payments</td><td class="n">-${usd(sampleBill.insurancePaid)}</td></tr>
      <tr><td>Insurance adjustments</td><td class="n">-${usd(sampleBill.adjustments)}</td></tr>
      <tr class="due"><td>AMOUNT DUE FROM PATIENT</td><td class="n">${usd(sampleBill.amountDue)}</td></tr>
    </table>
    <p class="muted">SAMPLE DOCUMENT. All names and numbers are invented for the ClaimBack demo.</p>
  </body></html>`;
}

function eobHtml() {
  const rows = sampleEob.lines
    .map(
      (l) =>
        `<tr><td>${l.date}</td><td>${l.code}</td><td>${l.description}${l.status === "denied" ? `<br><b>DENIED:</b> ${l.denialReason}` : ""}</td>` +
        `<td class="n">${usd(l.billed)}</td><td class="n">${usd(l.allowed)}</td><td class="n">${usd(l.insurerPaid)}</td><td class="n">${usd(l.patientResponsibility)}</td></tr>`,
    )
    .join("");
  return `<html><head><style>${style}</style></head><body>
    <h1>${sampleEob.insurer}</h1>
    <h2>EXPLANATION OF BENEFITS &mdash; THIS IS NOT A BILL</h2>
    <div>Member: Jordan Sample &middot; Claim number: ${sampleEob.claimNumber} &middot; Provider: ${sampleBill.provider}</div>
    <div>Network status: ${samplePlan.inNetwork ? "In-network" : "Out-of-network"}</div>
    <table><tr><th>Date</th><th>Code</th><th>Service</th><th class="n">Billed</th><th class="n">Allowed</th><th class="n">Plan paid</th><th class="n">You owe</th></tr>${rows}</table>
    <div class="box">
      Deductible applied: ${usd(sampleEob.deductibleApplied)} &middot;
      Coinsurance: ${usd(sampleEob.coinsuranceApplied)} &middot;
      <b>Total patient responsibility: ${usd(sampleEob.totalPatientResponsibility)}</b>
    </div>
    <p class="muted">SAMPLE DOCUMENT. All names and numbers are invented for the ClaimBack demo.</p>
  </body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });

await page.setContent(billHtml());
await page.pdf({ path: `${OUT}sample-bill.pdf`, format: "Letter" });
// A slightly rotated, shaded render, like a photo taken with a phone.
await page.addStyleTag({
  content: `html { background: #8a8578; } body { background: #fbfaf6; padding: 30px; margin: 40px;
    transform: rotate(-1.2deg); box-shadow: 0 8px 30px rgba(0,0,0,.4); filter: contrast(.95) brightness(.97); }`,
});
await page.screenshot({ path: `${OUT}sample-bill.jpg`, type: "jpeg", quality: 80, fullPage: true });

await page.setContent(eobHtml());
await page.pdf({ path: `${OUT}sample-eob.pdf`, format: "Letter" });

await browser.close();
console.log("Wrote sample-bill.pdf, sample-bill.jpg and sample-eob.pdf to public/samples/");
