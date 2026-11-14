"use client";

import { useState } from "react";
import type { FamilyInfo } from "@/lib/familyClient";
import { TextButton } from "./ui";

const SMALL_BUTTON =
  "press inline-flex items-center justify-center rounded-full border border-action bg-paper px-4 py-2 text-caption font-semibold text-action hover:bg-desk disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The second option on the paywall, under the $19 button: the family plan,
 * and "I have a family plan" to restore it in this browser with the card.
 */
export function FamilyOffer({
  busy,
  onBuy,
  onRestore,
}: {
  busy: boolean;
  onBuy: () => void;
  onRestore: () => void;
}) {
  return (
    <div className="rounded-[14px] border border-rule bg-paper/70 px-4 py-3">
      <p className="text-caption font-semibold text-ink">
        Family plan: $79/year, unlimited cases for your household
      </p>
      <p className="mt-0.5 text-fine text-ink-muted">Cancel anytime. Up to 5 devices.</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={onBuy} disabled={busy} className={SMALL_BUTTON}>
          Get the family plan
        </button>
        <TextButton onClick={onRestore} disabled={busy}>
          I have a family plan
        </TextButton>
      </div>
    </div>
  );
}

async function postJson(url: string): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const response = await fetch(url, { method: "POST" });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, data };
}

/**
 * For a device on an active family plan, in place of the paywall and the
 * loyalty card. The buyer's devices can add a family member (a one-time
 * link) and manage the subscription in Stripe's portal.
 */
export function FamilyPlate({ family, opening }: { family: FamilyInfo; opening: boolean }) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState<"" | "copied" | "select">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const full = family.devices >= family.maxDevices;

  async function addMember() {
    setBusy(true);
    setError("");
    setCopied("");
    const { ok, data } = await postJson("/api/family/invite").catch(() => ({ ok: false, data: {} as Record<string, unknown> }));
    if (ok && typeof data.url === "string") setLink(data.url);
    else setError(typeof data.error === "string" ? data.error : "Could not make an invite link.");
    setBusy(false);
  }

  async function manage() {
    setBusy(true);
    setError("");
    const { ok, data } = await postJson("/api/family/portal").catch(() => ({ ok: false, data: {} as Record<string, unknown> }));
    if (ok && typeof data.url === "string") {
      window.location.href = data.url;
      return;
    }
    setError(typeof data.error === "string" ? data.error : "Could not open the subscription page.");
    setBusy(false);
  }

  async function copy() {
    let done = false;
    try {
      // Some browsers never answer a clipboard request without permission.
      await Promise.race([
        navigator.clipboard.writeText(link),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 1500)),
      ]);
      done = true;
    } catch {
      // Older or embedded browsers: copy the selected text instead.
      const input = document.getElementById("family-invite-link") as HTMLInputElement | null;
      input?.select();
      try {
        done = document.execCommand("copy");
      } catch {
        done = false;
      }
    }
    setCopied(done ? "copied" : "select");
  }

  return (
    <div className="rounded-[14px] border border-ok/50 bg-paper/70 px-4 py-3" data-testid="family-plate">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-2 text-caption font-semibold text-ink">
          <span
            aria-hidden="true"
            className="flex size-5 items-center justify-center rounded-full bg-ok text-white"
          >
            <svg viewBox="0 0 16 16" className="size-3">
              <path
                d="M3.5 8.5l3 3 6-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Family plan active
        </span>
        <span className="text-fine text-ink-muted">
          {family.devices} of {family.maxDevices} devices
        </span>
      </div>
      <p className="mt-1 text-fine text-ink-muted">
        {opening ? "Opening your letters…" : "Every case is unlocked on this device."}
      </p>

      {family.owner ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <TextButton onClick={addMember} disabled={busy || full}>
            Add a family member
          </TextButton>
          <TextButton onClick={manage} disabled={busy}>
            Manage subscription
          </TextButton>
        </div>
      ) : (
        <p className="mt-2 text-fine text-ink-muted">
          The person who bought the plan can add devices and manage it.
        </p>
      )}
      {family.owner && full && (
        <p className="mt-2 text-fine text-ink-muted">All {family.maxDevices} devices are in use.</p>
      )}

      {link && (
        <div className="mt-3">
          <label htmlFor="family-invite-link" className="text-fine text-ink-muted">
            Send this link to one family member. It works once, for 7 days.
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="family-invite-link"
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-full border border-rule bg-paper px-4 font-mono text-fine text-bill-text outline-none focus:border-action"
            />
            <button type="button" onClick={copy} className={SMALL_BUTTON}>
              {copied === "copied" ? "Copied" : "Copy link"}
            </button>
          </div>
          {copied === "select" && (
            <p className="mt-1 text-fine text-ink-muted">
              The link is selected. Press Ctrl+C (⌘C on a Mac) to copy it.
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-fine font-semibold text-pen">
          {error}
        </p>
      )}
    </div>
  );
}
