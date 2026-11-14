import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Small building blocks from docs/DESIGN.md, so every screen uses the same
 * buttons, bands, cards and chips instead of one-off class lists.
 */

const BUTTON =
  "press inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-body font-semibold disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS = {
  primary: "bg-primary text-white hover:bg-primary-focus",
  secondary: "border border-primary text-primary hover:bg-primary/5",
  /** Secondary button on a dark band. */
  secondaryOnDark: "border border-primary-on-dark text-primary-on-dark hover:bg-white/5",
} as const;

type Variant = keyof typeof VARIANTS;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button {...props} className={`${BUTTON} ${VARIANTS[variant]} ${className}`} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link {...props} className={`${BUTTON} ${VARIANTS[variant]} ${className}`} />;
}

/** A plain text action: Action Blue, underline on hover/focus only. */
export function TextButton({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className={`text-caption text-primary hover:underline disabled:opacity-50 ${className}`}
    />
  );
}

const TONES = {
  light: "bg-canvas text-ink",
  parchment: "bg-parchment text-ink",
  dark: "bg-tile-dark text-on-dark",
} as const;

/** A full-width section; light and dark bands alternate instead of borders. */
export function Band({
  tone = "light",
  wide = false,
  className = "",
  children,
}: {
  tone?: keyof typeof TONES;
  /** 1200px for tables, 980px for reading. */
  wide?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${TONES[tone]} px-4 py-12 sm:px-6 md:py-20 ${className}`}>
      <div className={`mx-auto w-full ${wide ? "max-w-[1200px]" : "max-w-[980px]"}`}>
        {children}
      </div>
    </section>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-[18px] border border-hairline bg-canvas p-6 ${className}`}>
      {children}
    </div>
  );
}

const CHIPS = {
  neutral: "bg-parchment text-ink-muted",
  flag: "bg-flag-soft text-flag",
  ok: "bg-parchment text-ok",
} as const;

/** A status word. Status colors are never used without a word. */
export function Chip({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof CHIPS;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-fine font-semibold ${CHIPS[tone]}`}
    >
      {children}
    </span>
  );
}

/** A labeled pill input with an optional unit ($, %). */
export const INPUT =
  "money h-11 w-full rounded-full border border-hairline bg-parchment px-4 text-body outline-none focus:border-primary-focus focus:ring-2 focus:ring-primary-focus/30";

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-[18px] bg-flag-soft px-5 py-4 text-caption text-ink">
      <span className="font-semibold text-flag">Problem: </span>
      {children}
    </div>
  );
}
