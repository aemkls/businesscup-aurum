"use client";

import { useRef } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Shorter label for phones. */
  short?: string;
}

/**
 * Folder tabs on the edge of the case file, following the WAI-ARIA tabs
 * pattern: arrow keys, Home and End move between tabs and activate them.
 */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: React.KeyboardEvent) {
    const index = tabs.findIndex((t) => t.id === active);
    const keys: Record<string, number> = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="-mx-4 flex items-end gap-1 px-2 sm:mx-0 sm:gap-1.5 sm:px-3"
    >
      {tabs.map((tab, i) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`whitespace-nowrap rounded-t-[10px] px-2.5 text-caption sm:px-5 ${
              selected
                ? "bg-paper pb-3 pt-3 font-semibold text-ink"
                : "bg-desk-deep pb-2 pt-2 text-ink-muted hover:text-ink"
            }`}
          >
            {tab.short ? (
              <>
                <span className="sm:hidden">{tab.short}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </>
            ) : (
              tab.label
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The open folder page under the tabs. */
export function TabPanel({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="-mx-4 sm:mx-0">
      <div className="paper rounded-b-[4px] px-4 py-6 text-ink sm:rounded-tr-[4px] sm:px-8 sm:py-8">
        {children}
      </div>
    </div>
  );
}
