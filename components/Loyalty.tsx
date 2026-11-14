"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLoyalty } from "@/lib/loyaltyClient";

export const LOYALTY_TERMS =
  "Same card, same browser. Card wallets like Apple Pay may not count, type your card number.";

/**
 * The loyalty card next to the pay button: 3 stamps for paid cases, the 4th
 * circle is the free case. Turns to the action color when the free case is
 * ready.
 */
export function LoyaltyCard({ stamps, className = "" }: { stamps: number; className?: string }) {
  const full = stamps >= 3;
  return (
    <div
      className={`rounded-[14px] border px-4 py-3 ${
        full ? "border-action bg-action/5" : "border-rule bg-paper/70"
      } ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-[150px] flex-1">
          <p className="text-caption font-semibold text-ink">Loyalty card</p>
          <p className={`text-fine ${full ? "font-semibold text-action" : "text-ink-muted"}`}>
            {full
              ? "Your 4th case is free."
              : `${stamps} of 3 paid cases. Every 4th case is free.`}
          </p>
        </div>
        <ol className="flex shrink-0 items-start gap-2" aria-label={`${stamps} of 3 stamps`}>
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex flex-col items-center">
              <span
                className={`flex size-9 items-center justify-center rounded-full ${
                  i < stamps
                    ? "bg-ink text-white"
                    : "border-2 border-dashed border-rule bg-paper text-transparent"
                }`}
              >
                <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
                  <path
                    d="M3.5 8.5l3 3 6-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="sr-only">{i < stamps ? "Stamped" : "Empty"}</span>
            </li>
          ))}
          <li className="flex flex-col items-center">
            <span
              className={`flex size-9 items-center justify-center rounded-full border-2 font-mono text-[12px] font-semibold ${
                full
                  ? "border-action bg-action text-white"
                  : "border-dashed border-ink-muted/50 bg-paper text-ink-muted"
              }`}
            >
              $0
            </span>
            <span
              className={`mt-0.5 text-[11px] font-semibold leading-none ${
                full ? "text-action" : "text-ink-muted"
              }`}
            >
              Free
            </span>
          </li>
        </ol>
      </div>
      <p className="mt-2 text-fine text-ink-muted">{LOYALTY_TERMS}</p>
    </div>
  );
}

const NOTICE_KEY = "claimback.loyaltyNotice.v1";

const noticeListeners = new Set<() => void>();
let noticeDismissed = false; // remembered for this page view if storage is blocked

function noticeSeen(): boolean {
  if (noticeDismissed) return true;
  try {
    return window.localStorage.getItem(NOTICE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeNotice(onChange: () => void): () => void {
  noticeListeners.add(onChange);
  return () => noticeListeners.delete(onChange);
}

function dismissNotice() {
  noticeDismissed = true;
  try {
    window.localStorage.setItem(NOTICE_KEY, "1");
  } catch {
    // Storage blocked: it will simply show again next visit.
  }
  noticeListeners.forEach((l) => l());
}

/** First visit: a small card about the loyalty card, until "Got it". */
export function LoyaltyNotice() {
  const loyalty = useLoyalty();
  // The server render counts as seen, so nothing flashes before hydration.
  const seen = useSyncExternalStore(subscribeNotice, noticeSeen, () => true);

  if (!loyalty?.enabled || seen) return null;

  return (
    <aside
      aria-label="Loyalty card"
      className="no-print fixed inset-x-4 bottom-4 z-40 mx-auto max-w-[400px] sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      <div className="paper-shadow">
        <div className="rounded-[14px] bg-paper px-5 py-4">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-action font-mono text-[11px] font-semibold text-action"
            >
              $0
            </span>
            <div>
              <p className="text-caption font-semibold text-ink">
                Loyalty card: every 4th case is free.
              </p>
              <p className="mt-1 text-fine text-ink-muted">
                Pay for 3 cases with the same card in this browser, and your 4th case unlocks for
                $0. To claim it, you confirm the same card. Nothing is charged.
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={dismissNotice}
              className="press rounded-full bg-action px-5 py-2 text-caption font-semibold text-white hover:bg-action-hover"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

/** A short message at the top of the screen that goes away by itself. */
export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 7000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className="no-print fixed inset-x-4 top-16 z-50 mx-auto flex max-w-[440px] items-center gap-3 rounded-[14px] bg-ink px-5 py-3 text-caption text-white shadow-lg">
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-ink"
      >
        <svg viewBox="0 0 16 16" className="size-3.5">
          <path
            d="M3.5 8.5l3 3 6-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <p className="flex-1 font-semibold">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="-mr-1 rounded-full px-2 text-[20px] leading-none text-white/70 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}
