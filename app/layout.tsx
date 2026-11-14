import "@fontsource-variable/inter";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClaimBack: check your medical bill against your insurance",
  description:
    "Upload a medical bill and your EOB. ClaimBack checks them against your plan, finds what you should not owe and writes the dispute for you.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">
        <header className="no-print border-b border-hairline bg-canvas/95">
          <div className="mx-auto flex h-12 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6">
            <Link href="/" className="text-tagline font-semibold tracking-tight">
              ClaimBack
            </Link>
            <nav className="flex items-center gap-6 text-caption">
              <span className="hidden text-ink-muted sm:inline">No account. Files are never stored.</span>
              <Link href="/case" className="text-primary hover:underline">
                My case
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="no-print bg-parchment px-4 py-6 sm:px-6">
          <p className="mx-auto max-w-[980px] text-fine text-ink-muted">
            ClaimBack is software, not a law firm or a medical provider. It does not give legal or
            medical advice. Findings are potential issues for you to verify with your provider and
            insurer. All sample documents are invented.
          </p>
        </footer>
      </body>
    </html>
  );
}
