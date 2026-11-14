"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ResultsView } from "@/components/ResultsView";

function ResultsFromUrl() {
  return <ResultsView sessionId={useSearchParams().get("session_id")} />;
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading your case…</p>}>
      <ResultsFromUrl />
    </Suspense>
  );
}
