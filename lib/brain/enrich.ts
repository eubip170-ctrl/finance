import { MODELS, completeJSON } from "@/lib/llm/openai";
import {
  ALL_TOPICS,
  ENTITY_KINDS,
  canonicalizeTopics,
  isEntity,
  type Entity,
  type Sentiment,
} from "./taxonomy";

export type EnrichmentResult = {
  summary: string;
  entities: Entity[];
  topics: string[];
  sentiment: Sentiment | null;
};

/** Cap raw_text we send to the LLM. Most RSS / news items are well under
 *  this; long PDFs and transcripts get truncated rather than fanning out
 *  into a per-chunk multi-call summarizer (kept for a later phase). */
const MAX_INPUT_CHARS = 6000;

const SYSTEM = `You are a markets-and-macro analyst. You read a financial document and extract structured metadata about it for a Bloomberg-style research workbench.

Rules:
- Be specific. Generic answers are useless.
- Topics MUST be picked from this controlled vocabulary (no inventions). If nothing fits, return an empty list:
${ALL_TOPICS.join(", ")}
- Entities: pull tickers, named people, central banks, companies, countries, asset classes, macro indicators, and scheduled events. Skip generic terms. Use canonical names ("Federal Reserve" not "Fed", "AAPL" not "Apple stock"). Allowed kinds: ${ENTITY_KINDS.join(", ")}.
- Sentiment is about the article's stance on risk assets / the asset under discussion: bullish, bearish, or neutral. Use "neutral" for pure news / data prints with no editorial slant.
- Summary: 2-4 sentences, plain prose, no markdown, no preamble. State WHAT happened or was argued and WHY it matters for markets.

Respond as a single JSON object exactly matching:
{
  "summary": string,
  "entities": [{"kind": string, "value": string}],
  "topics": string[],
  "sentiment": "bullish" | "bearish" | "neutral"
}`;

type RawEnrichment = {
  summary?: unknown;
  entities?: unknown;
  topics?: unknown;
  sentiment?: unknown;
};

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + " …[truncated]";
}

export async function enrichDocument(input: {
  title: string;
  rawText: string;
  sourceType: string;
}): Promise<EnrichmentResult> {
  const prompt = `Source type: ${input.sourceType}
Title: ${input.title}

Body:
${truncate(input.rawText, MAX_INPUT_CHARS)}`;

  const raw = await completeJSON<RawEnrichment>({
    model: MODELS.fast,
    system: SYSTEM,
    prompt,
    maxTokens: 600,
    temperature: 0.1,
  });

  const summary =
    typeof raw.summary === "string" ? clean(raw.summary).slice(0, 1200) : "";

  const entities: Entity[] = Array.isArray(raw.entities)
    ? raw.entities.filter(isEntity).slice(0, 25)
    : [];

  const topics = Array.isArray(raw.topics)
    ? canonicalizeTopics(
        raw.topics.filter((t): t is string => typeof t === "string"),
        5,
      )
    : [];

  const sentiment: Sentiment | null =
    raw.sentiment === "bullish" || raw.sentiment === "bearish" || raw.sentiment === "neutral"
      ? raw.sentiment
      : null;

  return { summary, entities, topics, sentiment };
}
