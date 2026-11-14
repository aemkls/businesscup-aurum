import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/caveat/500.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { LoyaltyNotice } from "@/components/Loyalty";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClaimBack: check your medical bill against your insurance",
  description:
    "Add your plan and your hospital bill. ClaimBack checks every line against your insurance, marks what you likely don't owe and writes the letters to fix it.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#e8edf2" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col overflow-x-hidden">
        <header className="no-print">
          <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6">
            <Link
              href="/"
              className="display flex items-baseline gap-1.5 text-tagline font-bold tracking-tight text-ink"
            >
              ClaimBack
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-5 -translate-y-0.5 rounded-sm bg-marker"
              />
            </Link>
            <nav className="flex items-center gap-6 text-caption">
              <span className="hidden text-ink-muted sm:inline">
                No account. We never store your files.
              </span>
              <Link href="/case" className="font-semibold text-action hover:underline">
                My case
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <LoyaltyNotice />
        <footer className="no-print border-t border-rule px-4 py-8 sm:px-6">
          <p className="mx-auto max-w-[1200px] text-fine text-ink-muted">
            ClaimBack is software, not a law firm or a medical provider. It does not give legal or
            medical advice. Each finding is something to check with your provider and insurer. All
            sample documents are made up.
          </p>
        </footer>
      </body>
    </html>
  );
}
