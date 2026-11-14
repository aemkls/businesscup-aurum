import { usd } from "../engine/money";
import type { Bill, BillLineItem, Eob } from "../types";

/**
 * Letters for the situations the rule engine cannot see in the numbers alone.
 * Plain templates, filled from the case; the user completes the brackets.
 */

const header = (to: string, re: string) => `[Your full name]
[Your address]
[Date]

${to}

Re: ${re}

To whom it may concern,
`;

const footer = `
Sincerely,
[Your full name]
[Phone or email]`;

export function itemizedBillRequest(bill: Bill): string {
  return `${header(`${bill.provider}\nPatient Billing Department`, `Request for an itemized bill, statement dated ${bill.statementDate || "[statement date]"}, account [account number]`)}
Please send me a complete itemized bill for the account above, listing each service with its date, CPT or HCPCS code, units and charge. The statement I received shows a balance of ${usd(bill.amountDue)} without that detail.

I also request a copy of my billing records under my HIPAA right of access. Please place the account on hold, with no late fees and no referral to collections, until I have received and reviewed the itemized bill.
${footer}`;
}

export function facilityFeeReview(bill: Bill, lines: BillLineItem[]): string {
  const list = lines.map((l) => `- ${l.date} ${l.code} ${l.description}: ${usd(l.charge)}`).join("\n");
  return `${header(`${bill.provider}\nPatient Billing Department`, `Facility fee on statement dated ${bill.statementDate || "[statement date]"}, account [account number]`)}
My bill includes a hospital facility fee for what I understood to be a regular clinic visit:

${list}

I was not told before the visit that this location bills as a hospital outpatient department or that a separate facility fee would apply. Please send me the written notice you gave me, if any, and remove or reduce the fee. If your state requires advance disclosure of facility fees, please confirm how you met that requirement.
${footer}`;
}

export function goodFaithEstimateDispute(bill: Bill, estimate: number): string {
  const over = bill.amountDue - estimate;
  return `${header(`${bill.provider}\nPatient Billing Department`, `Bill above my Good Faith Estimate, statement dated ${bill.statementDate || "[statement date]"}, account [account number]`)}
I was a self-pay patient and received a Good Faith Estimate of ${usd(estimate)} for this care. The bill I received is ${usd(bill.amountDue)}, which is ${usd(over)} above the estimate.

Under the No Surprises Act, a self-pay patient billed at least $400 above the Good Faith Estimate may use the federal patient-provider dispute resolution process. Before I start that process, I ask you to adjust this bill to the amount of the estimate. Please put the account on hold while we resolve this.
${footer}`;
}

export function debtValidationRequest(bill: Bill): string {
  return `${header("[Collection agency name]\n[Collection agency address]", `Request for validation of debt, reference [collection account number]`)}
I received your notice about a medical debt said to be owed to ${bill.provider}. I dispute this debt and request validation under the Fair Debt Collection Practices Act.

Please send me the name of the original creditor, the itemized amount you say I owe with the dates of service, proof that you are authorized to collect it, and any record showing that my insurance was billed. Until you validate the debt, please stop collection and do not report it to any credit bureau.
${footer}`;
}

export function recallFromCollections(bill: Bill, eob: Eob | null): string {
  return `${header(`${bill.provider}\nPatient Billing Department`, `Request to recall my account from collections, statement dated ${bill.statementDate || "[statement date]"}`)}
My account was sent to a collection agency while ${eob ? "the charges were in dispute" : "my insurance had not been billed"}. I have disputed the balance in writing and I am ready to resolve it directly with you.

Please recall the account from the collection agency, confirm in writing that it will not be reported to any credit bureau, and send me a corrected itemized statement.
${footer}`;
}
