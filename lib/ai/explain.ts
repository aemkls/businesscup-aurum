import type { Finding } from "../types";
import { generateJson } from "./client";
import { usesOnlyKnownAmounts } from "./guard";
import { explanationsSchema } from "./schema";

const SYSTEM = `You rewrite findings from a medical bill review for a patient with
no billing background. For each finding write 2 or 3 short sentences in plain
English: what happened and why it matters. Use only the facts given. Keep every
dollar amount and code exactly as given and do not add new numbers. No legal or
medical advice, no promises about the outcome. Return the same ids.`;

/**
 * Asks the model to reword the engine's template explanations.
 * Amounts, titles and confidence are never changed. If the call fails or a
 * rewrite fails the number guard, the template text stays.
 */
export async function explainFindings(
  findings: Finding[],
  budgetMs: number,
): Promise<{ findings: Finding[]; aiWritten: boolean }> {
  if (findings.length === 0) return { findings, aiWritten: false };

  try {
    const { data } = await generateJson({
      system: SYSTEM,
      parts: [
        {
          text: JSON.stringify(
            findings.map(({ id, title, explanation, evidence }) => ({
              id,
              title,
              facts: [explanation, ...evidence],
            })),
          ),
        },
      ],
      schema: explanationsSchema,
      budgetMs,
    });

    const rewritten = new Map(data.explanations.map((e) => [e.id, e.explanation.trim()]));
    let used = 0;
    const result = findings.map((f) => {
      const text = rewritten.get(f.id);
      if (!text || !usesOnlyKnownAmounts(text, [f.explanation, ...f.evidence])) return f;
      used++;
      return { ...f, explanation: text };
    });
    return { findings: result, aiWritten: used > 0 };
  } catch {
    return { findings, aiWritten: false };
  }
}
