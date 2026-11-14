"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckFlow } from "@/components/CheckFlow";
import { sampleFromParam } from "@/data/samples";
import { Section } from "@/components/ui";

function CheckFromUrl() {
  const sample = sampleFromParam(useSearchParams().get("sample"));
  // The key resets the form when switching between samples and a real check.
  return <CheckFlow key={sample ?? "own"} sample={sample} />;
}

export default function CheckPage() {
  return (
    <Suspense
      fallback={
        <Section>
          <p className="text-ink-muted">Loading…</p>
        </Section>
      }
    >
      <CheckFromUrl />
    </Suspense>
  );
}
