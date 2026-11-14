import { GoogleGenAI, type Part } from "@google/genai";
import { z } from "zod";

/**
 * Thin wrapper around Gemini structured output.
 *
 * Free-tier Flash models answer 429/503 under load, so every call walks a
 * list of models and retries with backoff until an overall deadline. The
 * response is validated with zod before anything else in the app sees it.
 */

const FALLBACK_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

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

  const ai = new GoogleGenAI({ apiKey });
  const deadline = Date.now() + call.budgetMs;
  let lastError: unknown;

  for (const model of models()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 3000) break;
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: call.parts }],
          config: {
            systemInstruction: call.system,
            temperature: 0,
            responseMimeType: "application/json",
            responseJsonSchema: z.toJSONSchema(call.schema),
            httpOptions: { timeout: remaining },
          },
        });
        const parsed = call.schema.safeParse(JSON.parse(response.text ?? ""));
        if (parsed.success) return { data: parsed.data, model };
        lastError = parsed.error; // malformed answer: one more try on the same model
      } catch (error) {
        lastError = error;
        const status = statusOf(error);
        if (status === 400 || status === 401 || status === 403) {
          // Bad key or bad request: no other model will fix it.
          throw new AiUnavailableError(`Gemini rejected the request (${status})`);
        }
        if (status === 404) break; // unknown model name, try the next one
        if (status !== undefined && !RETRYABLE.has(status)) break;
        await sleep(800 * (attempt + 1));
      }
    }
  }

  console.error("Gemini call failed on every model", lastError);
  throw new AiUnavailableError("The AI service is busy. Please try again in a minute.");
}
