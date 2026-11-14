/**
 * Denial decoder: turns the insurer's denial remark into what it means and
 * the fastest way out. Many denials are paperwork, not medicine, and are
 * fixed with a phone call or a corrected claim instead of a formal appeal.
 */

export type DenialCategory =
  | "other_insurance"
  | "prior_authorization"
  | "out_of_network"
  | "timely_filing"
  | "coding_or_missing_info"
  | "medical_necessity"
  | "not_covered"
  | "duplicate"
  | "eligibility"
  | "unknown";

export interface DenialAdvice {
  category: DenialCategory;
  label: string;
  meaning: string;
  /** Who can fix it fastest. */
  whoFixes: "you" | "provider" | "insurer";
  /** The quickest path, in one line. */
  fastestFix: string;
  steps: string[];
  /** Whether a formal internal appeal is usually the right tool. */
  appeal: boolean;
}

const RULES: { category: DenialCategory; match: RegExp }[] = [
  { category: "other_insurance", match: /coordination of benefits|\bcob\b|other (insurance|coverage)|primary (payer|insurance)/i },
  { category: "prior_authorization", match: /prior auth|pre-?auth|precert|authori[sz]ation|referral/i },
  { category: "timely_filing", match: /timely filing|filing limit|submitted (too )?late|untimely/i },
  { category: "duplicate", match: /duplicate|already (paid|processed|submitted)/i },
  { category: "eligibility", match: /eligib|not (covered|enrolled) on (the )?date|terminated|coverage (ended|not active)|inactive/i },
  { category: "out_of_network", match: /out[- ]of[- ]network|non-?participating|not in network/i },
  { category: "coding_or_missing_info", match: /missing|incomplete|invalid|incorrect|modifier|diagnosis|coding|information (requested|needed)|medical records/i },
  { category: "medical_necessity", match: /medical(ly)? necess|not necessary|experimental|investigational/i },
  { category: "not_covered", match: /not covered|non-?covered|exclu|benefit (maximum|limit)|plan (does not|doesn't) cover/i },
];

const ADVICE: Record<DenialCategory, Omit<DenialAdvice, "category">> = {
  other_insurance: {
    label: "Your insurer thinks another plan should pay first",
    meaning: "This is a coordination of benefits hold, not a judgment on your care. It usually means the insurer is waiting for you to confirm whether you have other coverage.",
    whoFixes: "you",
    fastestFix: "Call your insurer or use their portal to confirm your other coverage, then ask them to reprocess the claim.",
    steps: [
      "Call the member services number on your card and say you are updating coordination of benefits.",
      "Confirm whether you have other insurance, even if the answer is no.",
      "Ask them to reprocess this claim and give you a reference number.",
    ],
    appeal: false,
  },
  prior_authorization: {
    label: "No prior authorization on file",
    meaning: "The plan wanted approval before the service. For emergencies, prior authorization is generally not allowed to block coverage. For planned care, the provider usually had to request it.",
    whoFixes: "provider",
    fastestFix: "Ask the provider to request a retroactive authorization or appeal on your behalf; in-network providers often cannot bill you for their missed authorization.",
    steps: [
      "Ask the provider's billing office whether they requested authorization and whether your contract lets them bill you.",
      "If it was an emergency, say so in writing: emergency care cannot require prior approval.",
      "If they will not fix it, file an internal appeal with a letter from your doctor.",
    ],
    appeal: true,
  },
  out_of_network: {
    label: "Processed as out-of-network",
    meaning: "The insurer treated the provider as outside your network. Emergency care and some care at in-network hospitals are protected under the No Surprises Act.",
    whoFixes: "insurer",
    fastestFix: "Check the provider directory for the date of service and ask the insurer to reprocess as in-network if the provider was listed.",
    steps: [
      "Take a screenshot of the insurer's provider directory showing the provider as in-network, if it does.",
      "If it was an emergency or you were treated at an in-network facility, cite the No Surprises Act.",
      "Ask for reprocessing; if refused, file an internal appeal.",
    ],
    appeal: true,
  },
  timely_filing: {
    label: "The provider filed the claim too late",
    meaning: "The provider missed the insurer's filing deadline. With an in-network provider, that is usually their loss under their contract, not your bill.",
    whoFixes: "provider",
    fastestFix: "Tell the provider the claim was denied for timely filing and ask them to write off the balance.",
    steps: [
      "Call the provider's billing office and read them the denial reason.",
      "Ask them to adjust the balance to $0 under their network contract.",
      "If they refuse, call your insurer and ask whether the provider may bill you for a timely filing denial.",
    ],
    appeal: false,
  },
  coding_or_missing_info: {
    label: "A paperwork or coding problem",
    meaning: "The claim was missing information or used a code the insurer rejected. This is fixed with a corrected claim, not an appeal.",
    whoFixes: "provider",
    fastestFix: "Ask the provider to submit a corrected claim with the right codes or records.",
    steps: [
      "Ask the provider's billing office what was missing.",
      "Ask them to send a corrected claim and tell you when.",
      "Check your insurer portal two weeks later for the reprocessed claim.",
    ],
    appeal: false,
  },
  medical_necessity: {
    label: "Denied as not medically necessary",
    meaning: "The insurer says the service was not needed under its criteria. These denials are overturned more often when the doctor explains why the care was needed.",
    whoFixes: "insurer",
    fastestFix: "Ask your doctor for a letter of medical necessity and file an internal appeal with it.",
    steps: [
      "Ask the insurer for the clinical criteria they used. You have a right to see them.",
      "Ask your doctor for a short letter explaining why the service was needed for you.",
      "File the internal appeal with the letter. If it is upheld, request an external review.",
    ],
    appeal: true,
  },
  not_covered: {
    label: "The plan says this service is not covered",
    meaning: "The insurer says your plan excludes this service. Check the plan document: sometimes it is covered under a different code or benefit.",
    whoFixes: "insurer",
    fastestFix: "Ask the insurer which plan provision excludes it, then ask the provider whether a different, covered code applies.",
    steps: [
      "Ask the insurer for the exact plan provision.",
      "Ask the provider if the service was coded correctly.",
      "If the exclusion is wrong, file an internal appeal citing your plan document.",
    ],
    appeal: true,
  },
  duplicate: {
    label: "Denied as a duplicate claim",
    meaning: "The insurer thinks it already processed this claim. If the provider is billing you for it, the other copy was probably already paid.",
    whoFixes: "provider",
    fastestFix: "Ask the provider to match it to the claim that was already paid and remove the duplicate balance.",
    steps: [
      "Ask the insurer for the claim number of the original claim.",
      "Give it to the provider and ask them to remove the duplicate balance.",
    ],
    appeal: false,
  },
  eligibility: {
    label: "The insurer says you were not covered that day",
    meaning: "Your coverage did not show as active on the date of service. This is often a data mismatch after a job change or a new card.",
    whoFixes: "you",
    fastestFix: "Confirm your coverage dates with your insurer or HR, then ask the provider to rebill with the right member ID.",
    steps: [
      "Check your coverage start date with your insurer or employer.",
      "Send the provider your current card and member ID.",
      "Ask them to resubmit the claim.",
    ],
    appeal: false,
  },
  unknown: {
    label: "Denied",
    meaning: "The EOB does not explain the reason in plain words.",
    whoFixes: "insurer",
    fastestFix: "Call the insurer and ask for the specific denial reason and the remark code meaning.",
    steps: [
      "Call member services and ask for the denial reason in writing.",
      "Then use the matching fix, or file an internal appeal.",
    ],
    appeal: true,
  },
};

export function decodeDenial(reason: string): DenialAdvice {
  const category = RULES.find((r) => r.match.test(reason))?.category ?? "unknown";
  return { category, ...ADVICE[category] };
}
