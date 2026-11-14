"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * The family plan as the server reports it (GET /api/family). Display only:
 * the plan lives in Stripe and in an httpOnly cookie the browser cannot read;
 * every decision is made on the server.
 */
export interface FamilyInfo {
  enabled: boolean;
  active: boolean;
  devices: number;
  maxDevices: number;
  /** This device bought the plan (or restored it with the card): may invite and manage. */
  owner: boolean;
}

const OFF: FamilyInfo = { enabled: false, active: false, devices: 0, maxDevices: 5, owner: false };

let state: FamilyInfo | null = null; // null until the first answer
let started = false;
let seq = 0;
const listeners = new Set<() => void>();

export function refreshFamily(): Promise<void> {
  started = true;
  const mine = ++seq;
  return fetch("/api/family", { cache: "no-store" })
    .then((r) => r.json())
    .catch(() => null)
    .then((data: Partial<FamilyInfo> | null) => {
      if (mine !== seq) return; // a newer request answers instead
      state =
        data && typeof data.enabled === "boolean"
          ? {
              enabled: data.enabled,
              active: Boolean(data.active),
              devices: Number(data.devices) || 0,
              maxDevices: Number(data.maxDevices) || 5,
              owner: Boolean(data.owner),
            }
          : OFF;
      listeners.forEach((l) => l());
    });
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Coming back to the tab (e.g. after a family member joined, or after the
  // billing portal) shows the current plan.
  const onFocus = () => {
    if (state?.active) void refreshFamily();
  };
  window.addEventListener("focus", onFocus);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("focus", onFocus);
  };
}

/** null while loading; { enabled: false } when the family plan is off on this deployment. */
export function useFamily(): FamilyInfo | null {
  const value = useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  );
  useEffect(() => {
    if (!started) void refreshFamily();
  }, []);
  return value;
}
