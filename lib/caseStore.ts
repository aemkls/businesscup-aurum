"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Household } from "./engine/assistance";
import type { Situation } from "./features/situation";
import type { AnalysisResult, CaseLetters } from "./types";

/**
 * The user's case lives in localStorage: there are no accounts and nothing
 * is kept on the server. This is what lets someone come back days later and
 * continue the dispute from the same browser.
 */
export interface StoredCase {
  result: AnalysisResult;
  createdAt: string; // ISO timestamp
  letters: CaseLetters | null;
  /** Tracker step id -> ISO date it was ticked off. */
  done: Record<string, string>;
  /** Optional answers to the financial assistance check. */
  household?: Household | null;
  /** Optional answers that unlock the extra checks in the action plan. */
  situation?: Situation;
}

const KEY = "claimback.case.v1";
const EVENT = "claimback:case";

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null; // storage blocked (private mode, embedded preview)
  }
}

export function saveCase(value: StoredCase | null): void {
  try {
    if (value) window.localStorage.setItem(KEY, JSON.stringify(value));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do: the case simply will not survive a reload.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function loadCase(): StoredCase | null {
  const raw = read();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredCase;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Returns undefined while rendering on the server / before hydration,
 * null when there is no saved case, otherwise the case.
 */
export function useCase(): StoredCase | null | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(
    subscribe,
    read,
    () => undefined,
  );
  return useMemo(() => {
    if (raw === undefined) return undefined;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredCase;
    } catch {
      return null;
    }
  }, [raw]);
}
