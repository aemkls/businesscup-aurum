import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Small building blocks from docs/DESIGN.md, so every screen uses the same
 * buttons, sections, paper and chips instead of one-off class lists.
 */

const BUTTON =
  "press inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-body font-semibold disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS = {
  primary: "bg-action text-white hover:bg-action-hover",
  secondary: "border border-action bg-paper/60 text-action hover:bg-paper",
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

/** A plain text action in the action color, underlined on hover. */
export function TextButton({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className={`text-caption font-semibold text-action hover:underline disabled:opacity-50 ${className}`}
    />
  );
}

/** A page section on the desk. 980px for reading, 1200px for wide layouts. */
export function Section({
  wide = false,
  className = "",
  children,
}: {
  wide?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`px-4 py-10 sm:px-6 md:py-16 ${className}`}>
      <div className={`mx-auto w-full ${wide ? "max-w-[1200px]" : "max-w-[980px]"}`}>
        {children}
      </div>
    </section>
  );
}

/**
 * A sheet of paper on the desk. On phones it runs edge to edge, like a
 * document held in the hand; from sm up it is a sheet with a shadow.
 */
export function Paper({
  torn = false,
  className = "",
  children,
}: {
  torn?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`paper-shadow -mx-4 sm:mx-0 ${className}`}>
      <div className={`paper sm:rounded-[4px] ${torn ? "paper-torn" : ""}`}>{children}</div>
    </div>
  );
}

const CHIPS = {
  neutral: "bg-desk text-ink-muted",
  marker: "bg-marker text-bill-text",
  ok: "bg-desk text-ok",
  /** A hard deadline: ink, the strongest neutral, with the word "Due". */
  deadline: "bg-ink font-mono text-white",
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

/** A pill input on paper. */
export const INPUT =
  "money h-11 w-full rounded-full border border-rule bg-paper px-4 font-mono text-body text-bill-text outline-none focus:border-action focus:ring-2 focus:ring-action/25";

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-[14px] border-l-4 border-pen bg-paper px-5 py-4 text-caption text-ink"
    >
      <span className="font-semibold text-pen">Problem: </span>
      {children}
    </div>
  );
}

/** A short handwritten note in red pen. Only used on paper. */
export function PenNote({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-hand text-note font-medium text-pen ${className}`}>{children}</span>
  );
}
