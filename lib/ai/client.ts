import { GoogleGenAI, ThinkingLevel, type Part } from "@google/genai";
import { z } from "zod";

/**
 * Thin wrapper around Gemini structured output.
 *
 * Free-tier Flash models often answer 503 ("high demand") or hang until a
 * 504, so a call walks a list of models, gives each attempt its own time
 * cap and moves on quickly when a model is overloaded, until an overall
 * deadline. The response is validated with zod before anything else in the
 * app sees it.
 */

/**
 * Tried in order after GEMINI_MODEL. Pinned Flash versions come first because
 * on the free tier the "-latest" aliases are the most overloaded and often
 * hang until a 504; the aliases stay as a last resort.
 */
const FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
];

/** Model aliases such as gemini-flash-latest only exist on v1beta. */
const API_VERSION = "v1beta";

/** No single attempt may use more than this, so one hung model cannot eat the whole budget. */
const ATTEMPT_CAP_MS = 20_000;

/** Overloaded or timed out: try another model. */
const OVERLOADED = new Set([408, 429, 500, 502, 503, 504]);

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export function aiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function models(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim();
  return [...new Set([...(preferred ? [preferred] : []), ...FALLBACK_MODELS])];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function statusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : undefined;
}

export interface JsonCall<T extends z.ZodType> {
  system: string;
  parts: Part[];
  schema: T;
  /** Overall time budget for all attempts, in milliseconds. */
  budgetMs: number;
}

export async function generateJson<T extends z.ZodType>(
  call: JsonCall<T>,
): Promise<{ data: z.infer<T>; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiUnavailableError("GEMINI_API_KEY is not set");

  const ai = new GoogleGenAI({ apiKey, apiVersion: API_VERSION });
  const deadline = Date.now() + call.budgetMs;
  const available = models();
  let lastError: unknown;

  // Up to two passes over the model list while time remains.
  for (let pass = 0; pass < 2; pass++) {
    for (const model of [...available]) {
      const remaining = deadline - Date.now();
      if (remaining < 3000) break;
      const started = Date.now();
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: call.parts }],
          config: {
            systemInstruction: call.system,
            temperature: 0,
            // Transcribing and rewording need little reasoning; low thinking keeps answers fast.
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: "application/json",
            responseJsonSchema: z.toJSONSchema(call.schema),
            httpOptions: { timeout: Math.min(remaining, ATTEMPT_CAP_MS) },
          },
        });
        const parsed = call.schema.safeParse(JSON.parse(response.text ?? ""));
        if (parsed.success) {
          console.info(`Gemini ${model} answered in ${Date.now() - started} ms`);
          return { data: parsed.data, model };
        }
        lastError = parsed.error; // malformed answer: the next model gets a try
      } catch (error) {
        lastError = error;
        const status = statusOf(error);
        console.warn(`Gemini ${model} failed after ${Date.now() - started} ms (status ${status ?? "none"})`);
        if (status === 400 || status === 401 || status === 403) {
          // Bad key or bad request: no other model will fix it.
          throw new AiUnavailableError(`Gemini rejected the request (${status})`);
        }
        if (status === 404) {
          // Unknown or retired model name: drop it for the rest of this call.
          available.splice(available.indexOf(model), 1);
          continue;
        }
        if (status !== undefined && !OVERLOADED.has(status)) break;
        await sleep(300);
      }
    }
    if (Date.now() < deadline - 3000) await sleep(1000);
  }

  console.error("Gemini call failed on every model", lastError);
  throw new AiUnavailableError("The AI service is busy. Please try again in a minute.");
}
