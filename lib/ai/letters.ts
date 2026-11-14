import { templateLetters } from "../letters/templates";
import type { Household } from "../engine/assistance";
import type { AnalysisResult, CaseLetters } from "../types";
import { generateJson } from "./client";
import { usesOnlyKnownAmounts } from "./guard";
import { lettersSchema } from "./schema";

const SYSTEM = `You help a patient dispute a US medical bill. You receive draft
documents built from verified findings. Rewrite them so they read like a calm,
firm, well-organized person wrote them. Keep every fact, code, date, dollar
amount and bracketed placeholder such as [Your full name] exactly as given.
Do not add findings, laws, statistics or amounts that are not in the drafts.
Do not threaten legal action. If a draft is empty, return an empty string for it.`;

/**
 * Writes the dispute letter, the insurer appeal and the call script.
 * The AI improves the wording of the template drafts; any document that
 * introduces an amount not present in its draft is replaced by the draft.
 */
export async function writeLetters(
  result: AnalysisResult,
  household: Household | null,
  budgetMs: number,
): Promise<CaseLetters> {
  const drafts = templateLetters(result, household);
  try {
    const { data } = await generateJson({
      system: SYSTEM,
      parts: [
        {
          text: JSON.stringify({
            providerLetter: drafts.providerLetter,
            insurerAppeal: drafts.insurerAppeal,
            callScript: drafts.callScript,
          }),
        },
      ],
      schema: lettersSchema,
      budgetMs,
    });

    const keep = (written: string, draft: string) =>
      draft && written.trim() && usesOnlyKnownAmounts(written, [draft]) ? written.trim() : draft;

    const letters = {
      providerLetter: keep(data.providerLetter, drafts.providerLetter),
      insurerAppeal: keep(data.insurerAppeal, drafts.insurerAppeal),
      callScript: keep(data.callScript, drafts.callScript),
    };
    const aiWritten =
      letters.providerLetter !== drafts.providerLetter ||
      letters.insurerAppeal !== drafts.insurerAppeal ||
      letters.callScript !== drafts.callScript;
    return { ...letters, assistanceLetter: drafts.assistanceLetter, aiWritten };
  } catch {
    return drafts;
  }
}
