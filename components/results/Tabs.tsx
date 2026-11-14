"use client";

import { useRef } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

/**
 * A pill segmented control following the WAI-ARIA tabs pattern: arrow keys,
 * Home and End move between tabs and activate them.
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
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="inline-flex whitespace-nowrap rounded-full bg-parchment p-1"
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
              className={`rounded-full px-3 py-2 text-caption sm:px-5 ${
                selected ? "bg-canvas font-semibold text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TabPanel({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="rise mt-8">
      {children}
    </div>
  );
}
