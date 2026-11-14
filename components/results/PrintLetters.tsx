"use client";

import { useEffect, useState } from "react";
import { createPortal, flushSync } from "react-dom";

export interface PrintDoc {
  title: string;
  text: string;
}

/**
 * Prints only the given letters, one per page, without the interface
 * (see the print styles in globals.css). The browser's print dialog
 * doubles as "Save as PDF".
 */
export function usePrintLetters(): { node: React.ReactNode; print: (docs: PrintDoc[]) => void } {
  const [docs, setDocs] = useState<PrintDoc[]>([]);

  useEffect(() => {
    const done = () => document.body.classList.remove("printing-letters");
    window.addEventListener("afterprint", done);
    return () => window.removeEventListener("afterprint", done);
  }, []);

  function print(next: PrintDoc[]) {
    flushSync(() => setDocs(next));
    document.body.classList.add("printing-letters");
    window.print();
  }

  const node =
    docs.length > 0
      ? createPortal(
          <div id="print-root" className="print-only">
            {docs.map((doc) => (
              <article key={doc.title} className="print-letter" aria-label={doc.title}>
                {doc.text}
              </article>
            ))}
          </div>,
          document.body,
        )
      : null;

  return { node, print };
}
