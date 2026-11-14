import { usd } from "../engine/money";
import type { AnalysisResult, CaseLetters, Finding } from "../types";

/**
 * Deterministic letters and call script built straight from the findings.
 * They are the fallback when the AI writer is unavailable, and the source of
 * truth for the amounts the AI version is allowed to mention.
 */

const total = (findings: Finding[]) => usd(findings.reduce((a, f) => a + f.amount, 0));

const numbered = (findings: Finding[]) =>
  findings
    .map((f, i) => `${i + 1}. ${f.title} (${usd(f.amount)})\n   ${f.evidence.join("\n   ")}`)
    .join("\n\n");

export function providerLetter(result: AnalysisResult): string {
  const items = result.findings.filter((f) => f.target === "provider");
  if (items.length === 0) return "";
  return `[Your full name]
[Your address]
[Date]

${result.bill.provider}
Patient Billing Department

Re: Dispute of statement dated ${result.bill.statementDate || "[statement date]"}, account [account number]

To whom it may concern,

I am writing to dispute charges on the statement above, which asks me to pay ${usd(result.amountBilled)}. After comparing the itemized bill with my insurer's Explanation of Benefits, I found the following errors totaling ${total(items)}:

${numbered(items)}

Please review these charges, correct the account and send me a revised itemized statement. Until I receive it, I ask that you place the account on hold and do not send it to collections.

Please reply in writing within 30 days.

Sincerely,
[Your full name]
[Phone or email]`;
}

export function insurerAppeal(result: AnalysisResult): string {
  const items = result.findings.filter((f) => f.target === "insurer");
  if (items.length === 0 || !result.eob) return "";
  return `[Your full name]
[Member ID]
[Date]

${result.eob.insurer}
Appeals Department

Re: Internal appeal, claim ${result.eob.claimNumber || "[claim number]"}

To whom it may concern,

I am requesting an internal appeal of the claim above. The Explanation of Benefits assigns me ${usd(result.eob.totalPatientResponsibility)}. I believe ${total(items)} of that was assigned in error:

${numbered(items)}

Please reprocess the claim according to my plan terms and send me a corrected Explanation of Benefits. If you uphold any part of this decision, please give me the specific plan provision you relied on and the clinical criteria used, along with instructions for requesting an external review.

Sincerely,
[Your full name]
[Phone or email]`;
}

export function callScript(result: AnalysisResult): string {
  const provider = result.findings.filter((f) => f.target === "provider");
  const lines = [
    `Calling: ${result.bill.provider}, billing department. Have your statement and EOB in front of you.`,
    "",
    `"Hi, I'm calling about my statement dated ${result.bill.statementDate || "[date]"}. I've compared it with my EOB and found errors I'd like corrected."`,
    "",
    ...provider.map(
      (f, i) => `${i + 1}. "${f.title}. That is ${usd(f.amount)} I should not be charged." (${f.evidence[0]})`,
    ),
    "",
    `"Can you correct these and send me a revised itemized statement? Please put the account on hold while it is under review."`,
    "",
    "Before you hang up, write down: the name of the person, the date, and a reference number for the call.",
    "If they refuse: ask for a supervisor and say you are also sending the dispute in writing.",
  ];
  return lines.join("\n");
}

export function templateLetters(result: AnalysisResult): CaseLetters {
  return {
    providerLetter: providerLetter(result),
    insurerAppeal: insurerAppeal(result),
    callScript: callScript(result),
    aiWritten: false,
  };
}
