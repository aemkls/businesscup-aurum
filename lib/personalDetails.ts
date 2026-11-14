"use client";

import { useSyncExternalStore } from "react";
import { EMPTY_DETAILS, type PersonalDetails } from "./letters/fill";

/**
 * The user's name, address and account numbers for the letters. Stored only
 * in this browser; never sent to the server.
 */

const KEY = "claimback.details.v1";
const EVENT = "claimback:details";

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveDetails(details: PersonalDetails | null): void {
  try {
    if (details) window.localStorage.setItem(KEY, JSON.stringify(details));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: details last until the page is closed.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** undefined before hydration, null when the user has not saved details yet. */
export function useDetails(): PersonalDetails | null | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, read, () => undefined);
  if (raw === undefined) return undefined;
  if (!raw) return null;
  try {
    return { ...EMPTY_DETAILS, ...(JSON.parse(raw) as Partial<PersonalDetails>) };
  } catch {
    return null;
  }
}
