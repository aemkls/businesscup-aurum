/**
 * A few facts about the user's situation that the documents do not show.
 * All optional, all kept in the browser with the case.
 */
export interface Situation {
  /** No insurance, or not using it for this care. */
  selfPay: boolean;
  /** Total of the written Good Faith Estimate, for self-pay patients. */
  goodFaithEstimate: number | null;
  /** The bill has been sent to a collection agency. */
  inCollections: boolean;
  /** Date of the first letter from the collector (ISO). */
  collectionNoticeDate: string | null;
  /** Date printed on the insurer's denial or EOB (ISO). */
  denialNoticeDate: string | null;
}

export const EMPTY_SITUATION: Situation = {
  selfPay: false,
  goodFaithEstimate: null,
  inCollections: false,
  collectionNoticeDate: null,
  denialNoticeDate: null,
};

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso.slice(0, 10)}T12:00:00Z`);
  const b = Date.parse(`${toIso.slice(0, 10)}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
