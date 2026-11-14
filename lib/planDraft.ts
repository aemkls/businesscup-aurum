"use client";

/**
 * The plan form is remembered in this browser, so a returning user does not
 * have to look up their deductible again. Values are kept as typed (strings).
 */

const KEY = "claimback.plan.v1";

export function loadPlanDraft<T extends object>(fallback: T): T {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<T>) } : fallback;
  } catch {
    return fallback; // storage blocked or corrupted value
  }
}

export function savePlanDraft(value: object): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage blocked: the form still works, it just is not remembered.
  }
}
