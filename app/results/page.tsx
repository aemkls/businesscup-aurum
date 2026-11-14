"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ResultsView } from "@/components/ResultsView";
import { Section } from "@/components/ui";

function ResultsFromUrl() {
  const params = useSearchParams();
  return (
    <ResultsView
      sessionId={params.get("session_id")}
      loyaltySession={params.get("loyalty_session")}
      familySession={params.get("family_session")}
      familyRestore={params.get("family_restore")}
      tab={params.get("tab")}
      finding={params.get("finding")}
    />
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <Section>
          <p className="text-ink-muted">Loading your case…</p>
        </Section>
      }
    >
      <ResultsFromUrl />
    </Suspense>
  );
}
