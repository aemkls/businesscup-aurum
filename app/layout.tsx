import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClaimBack: check your medical bill against your insurance",
  description:
    "Upload a medical bill and your EOB. ClaimBack checks them against your plan, finds what you should not owe and writes the dispute for you.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="no-print border-b border-line">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Claim<span className="text-accent">Back</span>
            </Link>
            <span className="text-sm text-muted">No account. Files are never stored.</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">{children}</main>
        <footer className="no-print border-t border-line">
          <p className="mx-auto max-w-5xl px-5 py-5 text-xs leading-relaxed text-muted">
            ClaimBack is software, not a law firm or a medical provider. It does not give legal or
            medical advice. Findings are potential issues for you to verify with your provider and
            insurer.
          </p>
        </footer>
      </body>
    </html>
  );
}
