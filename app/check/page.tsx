"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckFlow } from "@/components/CheckFlow";

function CheckFromUrl() {
  const sample = useSearchParams().get("sample") === "1";
  // The key resets the form when switching between the sample and a real check.
  return <CheckFlow key={String(sample)} sample={sample} />;
}

export default function CheckPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <CheckFromUrl />
    </Suspense>
  );
}
