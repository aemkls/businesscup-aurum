/**
 * Fills the bracketed placeholders in the letters ([Your full name], ...)
 * with the user's own details. Runs in the browser only: personal details
 * are kept in localStorage and never sent to the server.
 */

export interface PersonalDetails {
  fullName: string;
  /** Street, city, state, ZIP. May span several lines. */
  address: string;
  /** Phone number and/or email. */
  contact: string;
  /** Account number printed on the hospital statement. */
  accountNumber: string;
  /** Member ID from the insurance card. */
  memberId: string;
}

export const EMPTY_DETAILS: PersonalDetails = {
  fullName: "",
  address: "",
  contact: "",
  accountNumber: "",
  memberId: "",
};

const PLACEHOLDERS: [string, keyof PersonalDetails][] = [
  ["[Your full name]", "fullName"],
  ["[Your address]", "address"],
  ["[Phone or email]", "contact"],
  ["[account number]", "accountNumber"],
  ["[Member ID]", "memberId"],
];

export function formatLetterDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** Replaces every placeholder the user has filled in; empty ones stay visible. */
export function fillLetter(text: string, details: PersonalDetails, today: Date): string {
  let filled = text.replaceAll("[Date]", formatLetterDate(today));
  for (const [placeholder, key] of PLACEHOLDERS) {
    const value = details[key].trim();
    if (value) filled = filled.replaceAll(placeholder, value);
  }
  return filled;
}

/** Placeholders still left in a letter, e.g. to remind the user before sending. */
export function missingPlaceholders(text: string): string[] {
  return [...new Set(text.match(/\[[^\]\n]{2,40}\]/g) ?? [])];
}
