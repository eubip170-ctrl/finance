import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY env var");
  cached = new Anthropic({ apiKey });
  return cached;
}

export const MODELS = {
  /** Heavy reasoning: ontology, actor generation, scenario report. */
  reasoning: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7",
  /** Fast/cheap auxiliary: chunk titling, classification, short prompts. */
  fast: process.env.ANTHROPIC_FAST_MODEL ?? "claude-haiku-4-5-20251001",
} as const;

/**
 * Calls Claude expecting a JSON object response. Strips code fences and parses.
 * Throws on malformed JSON so callers can decide how to recover.
 */
export async function completeJSON<T = unknown>(opts: {
  model?: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<T> {
  const client = anthropic();
  const res = await client.messages.create({
    model: opts.model ?? MODELS.reasoning,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.2,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });

  const text = res.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();

  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  return JSON.parse(cleaned) as T;
}

export async function completeText(opts: {
  model?: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const client = anthropic();
  const res = await client.messages.create({
    model: opts.model ?? MODELS.reasoning,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.4,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });
  return res.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
}
