"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * The loyalty card as the server reports it (GET /api/loyalty). Display
 * only: the stamps live in an httpOnly cookie the browser cannot read, and
 * every decision is made on the server.
 */
export interface LoyaltyInfo {
  enabled: boolean;
  stamps: number;
  freeAvailable: boolean;
  /** A free case was confirmed but its letters are not fetched yet. */
  freePass: boolean;
}

const OFF: LoyaltyInfo = { enabled: false, stamps: 0, freeAvailable: false, freePass: false };

let state: LoyaltyInfo | null = null; // null until the first answer
let started = false;
let seq = 0;
const listeners = new Set<() => void>();

export function refreshLoyalty(): Promise<void> {
  started = true;
  const mine = ++seq;
  return fetch("/api/loyalty", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((data: Partial<LoyaltyInfo> | null) => {
      if (mine !== seq) return; // a newer request answers instead
      state =
        data && typeof data.enabled === "boolean"
          ? {
              enabled: data.enabled,
              stamps: Number(data.stamps) || 0,
              freeAvailable: Boolean(data.freeAvailable),
              freePass: Boolean(data.freePass),
            }
          : OFF;
      listeners.forEach((l) => l());
    });
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** null while loading; { enabled: false } when the card is off on this deployment. */
export function useLoyalty(): LoyaltyInfo | null {
  const value = useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  );
  useEffect(() => {
    if (!started) void refreshLoyalty();
  }, []);
  return value;
}
