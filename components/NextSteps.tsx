"use client";

import { useState } from "react";
import { saveCase, type StoredCase } from "@/lib/caseStore";
import { buildActionPlan, type Action } from "@/lib/features/actions";
import { EMPTY_SITUATION, type Situation } from "@/lib/features/situation";
import { Chip, INPUT, Paper, TextButton } from "./ui";

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * "Next steps": the action plan beyond the dispute letters, plus three
 * questions the documents cannot answer (self-pay, collections, denial date).
 * Everything is computed in the browser from the saved case.
 */
export function NextSteps({ saved }: { saved: StoredCase }) {
  const situation = saved.situation ?? EMPTY_SITUATION;
  const actions = buildActionPlan(saved.result, situation, saved.household ?? null);
  const unlocked = Boolean(saved.letters);

  function update(patch: Partial<Situation>) {
    saveCase({ ...saved, situation: { ...situation, ...patch } });
  }

  return (
    <div className="space-y-8">
      <SituationForm situation={situation} hasDenial={actions.some((a) => a.kind === "denial_fix")} onChange={update} />
      <ol className="space-y-4">
        {actions.map((action, i) => (
          <ActionCard key={action.id} action={action} index={i + 1} unlocked={unlocked} />
        ))}
      </ol>
    </div>
  );
}

function SituationForm({
  situation,
  hasDenial,
  onChange,
}: {
  situation: Situation;
  hasDenial: boolean;
  onChange: (patch: Partial<Situation>) => void;
}) {
  return (
    <fieldset className="rounded-[18px] border border-rule bg-paper p-5">
      <legend className="px-1 text-caption font-semibold text-ink">A few things your documents don’t show</legend>
      <div className="mt-2 grid gap-4 sm:grid-cols-3">
        <label className="flex items-start gap-3 text-caption text-ink">
          <input
            type="checkbox"
            checked={situation.selfPay}
            onChange={(e) => onChange({ selfPay: e.target.checked })}
            className="mt-1 size-4 accent-action"
          />
          <span>I’m uninsured or paying this myself</span>
        </label>
        <label className="flex items-start gap-3 text-caption text-ink">
          <input
            type="checkbox"
            checked={situation.inCollections}
            onChange={(e) => onChange({ inCollections: e.target.checked })}
            className="mt-1 size-4 accent-action"
          />
          <span>This bill is with a collection agency</span>
        </label>
        {hasDenial && (
          <label className="block text-caption text-ink">
            <span>Date on the denial letter or EOB</span>
            <input
              type="date"
              value={situation.denialNoticeDate ?? ""}
              onChange={(e) => onChange({ denialNoticeDate: e.target.value || null })}
              className={`${INPUT} mt-1`}
            />
          </label>
        )}
        {situation.selfPay && (
          <label className="block text-caption text-ink">
            <span>Good Faith Estimate total, if you got one</span>
            <input
              type="number"
              min={0}
              inputMode="decimal"
              value={situation.goodFaithEstimate ?? ""}
              onChange={(e) =>
                onChange({ goodFaithEstimate: e.target.value === "" ? null : Number(e.target.value) })
              }
              placeholder="e.g. 2500"
              className={`${INPUT} mt-1`}
            />
          </label>
        )}
        {situation.inCollections && (
          <label className="block text-caption text-ink">
            <span>Date of the collector’s first letter</span>
            <input
              type="date"
              value={situation.collectionNoticeDate ?? ""}
              onChange={(e) => onChange({ collectionNoticeDate: e.target.value || null })}
              className={`${INPUT} mt-1`}
            />
          </label>
        )}
      </div>
    </fieldset>
  );
}

function ActionCard({ action, index, unlocked }: { action: Action; index: number; unlocked: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <li>
      <Paper>
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-tagline font-semibold text-ink">
              <span className="mr-2 font-mono text-caption text-ink-muted">{index}.</span>
              {action.title}
            </h3>
            {action.deadline && (
              <Chip tone="marker">
                Due {formatDate(action.deadline.date)}
              </Chip>
            )}
          </div>
          <p className="mt-2 text-body text-ink-muted">{action.why}</p>
          {action.denial && (
            <p className="mt-3 text-caption text-ink">
              <span className="font-semibold">Fastest fix: </span>
              {action.denial.fastestFix}{" "}
              <span className="text-ink-muted">
                ({action.denial.appeal ? "a formal appeal is the right tool" : "no formal appeal needed"})
              </span>
            </p>
          )}
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-caption text-ink">
            {(action.denial ? action.denial.steps : action.steps).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {action.deadline && (
            <p className="mt-3 text-fine text-ink-muted">{action.deadline.label}</p>
          )}
          {action.letter && (
            <div className="mt-4">
              {unlocked ? (
                <>
                  <TextButton onClick={() => setOpen(!open)}>
                    {open ? "Hide the letter" : `Show the letter: ${action.letter.title}`}
                  </TextButton>
                  {open && (
                    <div className="mt-3 rounded-[14px] bg-desk p-4">
                      <pre className="whitespace-pre-wrap font-mono text-fine leading-relaxed text-bill-text">
                        {action.letter.text}
                      </pre>
                      <TextButton
                        className="mt-3"
                        onClick={async () => {
                          await navigator.clipboard.writeText(action.letter!.text);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                      >
                        {copied ? "Copied" : "Copy the letter"}
                      </TextButton>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-caption text-ink-muted">
                  Includes a ready letter ({action.letter.title}) when you unlock your case.
                </p>
              )}
            </div>
          )}
        </div>
      </Paper>
    </li>
  );
}
