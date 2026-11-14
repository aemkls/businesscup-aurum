/**
 * The model is only allowed to reword. This guard checks that every dollar
 * amount in AI-written text already exists in the source facts, so a
 * hallucinated number can never reach the user.
 */

const DOLLARS = /\$\s?(\d[\d,]*(?:\.\d{1,2})?)/g;

function amounts(text: string): number[] {
  return [...text.matchAll(DOLLARS)].map((m) => Number(m[1].replace(/,/g, "")));
}

export function usesOnlyKnownAmounts(text: string, sources: string[]): boolean {
  const known = new Set(sources.flatMap(amounts));
  return amounts(text).every((n) => known.has(n));
}
