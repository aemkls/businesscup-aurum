"use client";

import { useState } from "react";
import { useCase } from "@/lib/caseStore";
import { refreshFamily } from "@/lib/familyClient";
import { Button, ButtonLink, ErrorNote, Section } from "./ui";

/** /family/join?t=…: one family member joins the plan on this device. */
export function FamilyJoin({ token }: { token: string | null }) {
  const saved = useCase();
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState<null | { already: boolean }>(null);
  const [error, setError] = useState(token ? "" : "This invite link is not valid.");

  async function join() {
    setJoining(true);
    setError("");
    try {
      const response = await fetch("/api/family/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not join the family plan.");
      await refreshFamily();
      setJoined({ already: Boolean(data.already) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join the family plan.");
    }
    setJoining(false);
  }

  if (joined) {
    return (
      <Section>
        <div className="mx-auto max-w-[560px]">
          <h1 className="text-section-sm font-bold md:text-section">
            {joined.already ? "You're already on this family plan" : "You're on the family plan"}
          </h1>
          <p className="mt-4 text-body text-ink-muted">
            Every case on this device is unlocked: dispute letters, appeals and call scripts.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {saved ? (
              <ButtonLink href="/results?tab=letters">Open my case</ButtonLink>
            ) : (
              <ButtonLink href="/check">Check my bill</ButtonLink>
            )}
            <ButtonLink href="/check?sample=er" variant="secondary">
              Try with a sample bill
            </ButtonLink>
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="mx-auto max-w-[560px]">
        <h1 className="text-section-sm font-bold md:text-section">
          You&apos;ve been invited to a ClaimBack family plan
        </h1>
        <p className="mt-4 text-body text-ink-muted">
          Join to unlock every case on this device: we check your medical bills and write the
          letters to fix them. Nothing to pay. The link works once.
        </p>
        <div className="mt-8">
          <Button onClick={join} disabled={joining || !token} className="w-full sm:w-auto">
            {joining ? "Joining…" : "Join"}
          </Button>
        </div>
        {error && (
          <div className="mt-6">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
      </div>
    </Section>
  );
}
