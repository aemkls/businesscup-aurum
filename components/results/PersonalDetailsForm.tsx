"use client";

import { useState } from "react";
import { EMPTY_DETAILS, type PersonalDetails } from "@/lib/letters/fill";
import { saveDetails } from "@/lib/personalDetails";
import { Button, INPUT, TextButton } from "../ui";

const FIELDS: { key: keyof PersonalDetails; label: string; hint: string; multiline?: boolean }[] = [
  { key: "fullName", label: "Full name", hint: "As it appears on the bill." },
  { key: "address", label: "Mailing address", hint: "Street, city, state, ZIP.", multiline: true },
  { key: "contact", label: "Phone or email", hint: "Where they should reply." },
  { key: "accountNumber", label: "Hospital account number", hint: "Printed on the statement." },
  { key: "memberId", label: "Insurance member ID", hint: "On your insurance card." },
];

/**
 * Collects the details that go into the letters. They are saved only in
 * this browser and filled in on the client; the server never sees them.
 */
export function PersonalDetailsForm({
  initial,
  onDone,
  onSkip,
}: {
  initial: PersonalDetails | null;
  onDone: () => void;
  onSkip?: () => void;
}) {
  const [details, setDetails] = useState<PersonalDetails>(initial ?? EMPTY_DETAILS);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    saveDetails(details);
    onDone();
  }

  return (
    <form onSubmit={submit} className="rounded-[18px] bg-parchment p-6 sm:p-8">
      <h2 className="text-tagline font-semibold">Your details for the letters</h2>
      <p className="mt-2 text-caption text-ink-muted">
        We fill these into every letter so they are ready to send. They are saved only on this
        device and never sent to our servers. Leave any field empty to fill it in by hand.
      </p>
      <div className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.key} className={`block ${field.multiline ? "sm:row-span-2" : ""}`}>
            <span className="text-caption font-semibold">{field.label}</span>
            {field.multiline ? (
              <textarea
                rows={3}
                value={details[field.key]}
                onChange={(e) => setDetails({ ...details, [field.key]: e.target.value })}
                className="mt-2 block w-full rounded-[18px] border border-hairline bg-canvas px-4 py-3 text-body outline-none focus:border-primary-focus focus:ring-2 focus:ring-primary-focus/30"
              />
            ) : (
              <input
                type="text"
                autoComplete={field.key === "fullName" ? "name" : "off"}
                value={details[field.key]}
                onChange={(e) => setDetails({ ...details, [field.key]: e.target.value })}
                className={`${INPUT} mt-2 bg-canvas`}
              />
            )}
            <span className="mt-1 block text-fine text-ink-muted">{field.hint}</span>
          </label>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Button type="submit">Fill in my letters</Button>
        {onSkip && <TextButton onClick={onSkip}>Skip for now</TextButton>}
      </div>
    </form>
  );
}
