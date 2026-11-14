import type { Metadata } from "next";
import { CaseView } from "@/components/CaseView";

export const metadata: Metadata = { title: "My case | ClaimBack" };

export default function CasePage() {
  return <CaseView />;
}
