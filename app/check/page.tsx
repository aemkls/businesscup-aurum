"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckFlow } from "@/components/CheckFlow";
import { Band } from "@/components/ui";

function CheckFromUrl() {
  const sample = useSearchParams().get("sample") === "1";
  // The key resets the form when switching between the sample and a real check.
  return <CheckFlow key={String(sample)} sample={sample} />;
}

export default function CheckPage() {
  return (
    <Suspense
      fallback={
        <Band>
          <p className="text-ink-muted">Loading…</p>
        </Band>
      }
    >
      <CheckFromUrl />
    </Suspense>
  );
}
