"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ResultsView } from "@/components/ResultsView";
import { Band } from "@/components/ui";

function ResultsFromUrl() {
  const params = useSearchParams();
  return (
    <ResultsView
      sessionId={params.get("session_id")}
      tab={params.get("tab")}
      finding={params.get("finding")}
    />
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <Band>
          <p className="text-ink-muted">Loading your case…</p>
        </Band>
      }
    >
      <ResultsFromUrl />
    </Suspense>
  );
}
