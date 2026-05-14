import OpenAI from "openai";

let cached: OpenAI | null = null;

export function openai(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY env var");
  cached = new OpenAI({ apiKey });
  return cached;
}

export const MODELS = {
  /** Heavy reasoning: ontology, actor generation, scenario report. */
  reasoning: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  /** Fast/cheap auxiliary: chunk titling, classification, short prompts. */
  fast: process.env.OPENAI_FAST_MODEL ?? "gpt-4o-mini",
} as const;

/**
 * Calls OpenAI expecting a JSON object response. Uses response_format=json_object
 * which guarantees parseable JSON output.
 */
export async function completeJSON<T = unknown>(opts: {
  model?: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<T> {
  const client = openai();
  const res = await client.chat.completions.create({
    model: opts.model ?? MODELS.reasoning,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `${opts.system}\n\nYou MUST respond with valid JSON only.` },
      { role: "user", content: opts.prompt },
    ],
  });
  const text = res.choices[0]?.message?.content ?? "";
  return JSON.parse(text) as T;
}

export async function completeText(opts: {
  model?: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const client = openai();
  const res = await client.chat.completions.create({
    model: opts.model ?? MODELS.reasoning,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.4,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.prompt },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}
