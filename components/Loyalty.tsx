"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
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
/** Back from Stripe: the stamp toast and the letters come first, no dialog. */
const RETURN_FROM_PAYMENT = /[?&](session_id|loyalty_session)=/;

const noticeListeners = new Set<() => void>();
let noticeDismissed = false; // remembered for this page view if storage is blocked
let returnedFromPayment: boolean | null = null; // decided once per page load

function noticeSeen(): boolean {
  if (noticeDismissed) return true;
  // Decided on the URL the page loaded with, so the dialog does not pop up
  // later when the results page drops session_id from the URL.
  returnedFromPayment ??= RETURN_FROM_PAYMENT.test(window.location.search);
  if (returnedFromPayment) return true;
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

/**
 * First visit: a dialog about the loyalty card, once, until it is closed.
 * Not shown when the loyalty card is off, or on the return from a payment.
 */
export function LoyaltyNotice() {
  const loyalty = useLoyalty();
  // The server render counts as seen, so nothing flashes before hydration.
  const seen = useSyncExternalStore(subscribeNotice, noticeSeen, () => true);

  if (!loyalty?.enabled || seen) return null;
  return <LoyaltyDialog onClose={dismissNotice} />;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function LoyaltyDialog({ onClose }: { onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const gotIt = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    gotIt.current?.focus();

    // The page under the dialog does not scroll; keep its width steady.
    const html = document.documentElement;
    const scrollbar = window.innerWidth - html.clientWidth;
    const before = { overflow: html.style.overflow, padding: document.body.style.paddingRight };
    html.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      // Tab and Shift+Tab cycle inside the dialog.
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = panel.current.contains(active);
      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = before.overflow;
      document.body.style.paddingRight = before.padding;
      // Focus goes back to the page: where it was, or the top of the document.
      if (previous && previous !== document.body && previous.isConnected) previous.focus();
      else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    };
  }, [onClose]);

  return (
    <div className="no-print fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div aria-hidden="true" onClick={onClose} className="dialog-backdrop absolute inset-0 bg-ink/60" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="loyalty-dialog-title"
        aria-describedby="loyalty-dialog-text"
        className="dialog-panel relative max-h-[calc(100dvh-32px)] w-full max-w-[480px] overflow-y-auto rounded-[14px] bg-paper px-6 pb-6 pt-8 text-ink shadow-[0_24px_64px_rgb(19_33_58/0.35)] sm:px-8 sm:pb-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full text-[22px] leading-none text-ink-muted hover:bg-desk hover:text-ink"
        >
          ×
        </button>

        <ol
          aria-label="Loyalty card: 3 paid cases, then the 4th is free"
          className="flex items-start justify-center gap-3 rounded-[10px] bg-desk px-4 py-5 sm:gap-4"
        >
          {[1, 2, 3].map((n) => (
            <li key={n} className="flex flex-col items-center gap-1.5">
              <span className="flex size-12 items-center justify-center rounded-full bg-ink text-white">
                <svg viewBox="0 0 16 16" className="size-5" aria-hidden="true">
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
              <span className="text-fine text-ink-muted">Case {n}</span>
            </li>
          ))}
          <li className="flex flex-col items-center gap-1.5">
            <span className="flex size-12 items-center justify-center rounded-full bg-action font-mono text-[15px] font-semibold text-white ring-4 ring-action/25">
              $0
            </span>
            <span className="text-fine font-bold text-action">Free</span>
          </li>
        </ol>

        <h2 id="loyalty-dialog-title" className="mt-6 text-[28px] font-bold leading-tight tracking-tight">
          Every 4th case is free
        </h2>
        <p id="loyalty-dialog-text" className="mt-3 text-body text-ink-muted">
          Pay for 3 cases with the same card in this browser. Your 4th case unlocks for $0: you
          confirm the same card, nothing is charged.
        </p>
        <p className="mt-3 text-fine text-ink-muted">
          Same card, same browser. Apple Pay and other wallets may not count, type your card
          number.
        </p>
        <button
          ref={gotIt}
          type="button"
          onClick={onClose}
          className="press mt-6 w-full rounded-full bg-action px-6 py-3 text-body font-semibold text-white hover:bg-action-hover"
        >
          Got it
        </button>
      </div>
    </div>
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
