"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FamilyJoin } from "@/components/FamilyJoin";
import { Section } from "@/components/ui";

function JoinFromUrl() {
  const params = useSearchParams();
  return <FamilyJoin token={params.get("t")} />;
}

export default function FamilyJoinPage() {
  return (
    <Suspense
      fallback={
        <Section>
          <p className="text-ink-muted">Loading your invite…</p>
        </Section>
      }
    >
      <JoinFromUrl />
    </Suspense>
  );
}
