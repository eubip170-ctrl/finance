import { supabaseAdmin } from "@/lib/supabase/server";
import { MODELS, completeText } from "@/lib/llm/openai";
import { ingestDocument } from "./ingest";

export type TopicSummary = {
  topic: string;
  sentiment: { bullish: number; bearish: number; neutral: number };
  docCount: number;
  summary: string;
  sources: Array<{ id: string; title: string; sourceUrl: string | null }>;
};

export type BriefResult = {
  briefDocumentId: string;
  topicSummaries: number;
  sourceCount: number;
  durationMs: number;
};

type EnrichedDoc = {
  id: string;
  title: string;
  source_url: string | null;
  summary: string | null;
  topics: string[] | null;
  sentiment: "bullish" | "bearish" | "neutral" | null;
};

/** Minimum docs in a topic for it to make the brief — avoids one-off
 *  noise and keeps the LLM prompt focused. */
const MIN_DOCS_PER_TOPIC = 3;

/** How far back the brief window extends. 28h instead of 24 so a
 *  morning run still catches yesterday's late-US headlines. */
const WINDOW_HOURS = 28;

const SYSTEM_PER_TOPIC = `You are a markets-and-macro analyst writing a daily briefing for a portfolio manager. You are given a topic and the summaries of N news/research items from the last day on that topic.

Write 3-5 sentences in dense prose synthesizing what happened, what's notable, and any contradictions across sources. Reference the sources inline as [N] matching their order. No markdown headers, no bullet points, no preamble. Skip generic statements.`;

function bucket(docs: EnrichedDoc[]): Map<string, EnrichedDoc[]> {
  const groups = new Map<string, EnrichedDoc[]>();
  for (const d of docs) {
    for (const t of d.topics ?? []) {
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t)!.push(d);
    }
  }
  return groups;
}

function tallySentiment(docs: EnrichedDoc[]) {
  return docs.reduce(
    (acc, d) => {
      if (d.sentiment === "bullish") acc.bullish += 1;
      else if (d.sentiment === "bearish") acc.bearish += 1;
      else if (d.sentiment === "neutral") acc.neutral += 1;
      return acc;
    },
    { bullish: 0, bearish: 0, neutral: 0 },
  );
}

async function summarizeTopic(topic: string, docs: EnrichedDoc[]): Promise<string> {
  const numbered = docs
    .map(
      (d, i) =>
        `[${i + 1}] ${d.title.trim()} — ${d.summary?.replace(/\s+/g, " ").trim() ?? "(no summary)"}`,
    )
    .join("\n\n");

  const prompt = `Topic: ${topic}\n\nSources (last ${WINDOW_HOURS}h):\n${numbered}\n\nSynthesis:`;

  return completeText({
    model: MODELS.fast,
    system: SYSTEM_PER_TOPIC,
    prompt,
    maxTokens: 350,
    temperature: 0.2,
  });
}

function renderBriefMarkdown(date: string, summaries: TopicSummary[]): string {
  const lines: string[] = [];
  lines.push(`# Daily Brief — ${date}`);
  lines.push("");
  lines.push(
    `Synthesis of ${summaries.reduce((n, s) => n + s.docCount, 0)} items across ${summaries.length} topics. Auto-generated.`,
  );
  lines.push("");

  for (const s of summaries) {
    const tone = `(B${s.sentiment.bullish} · B${s.sentiment.bearish} · N${s.sentiment.neutral})`;
    lines.push(`## ${s.topic.toUpperCase()} ${tone}`);
    lines.push("");
    lines.push(s.summary.trim());
    lines.push("");
    lines.push("Sources:");
    s.sources.forEach((src, i) => {
      const link = src.sourceUrl ? ` — ${src.sourceUrl}` : "";
      lines.push(`- [${i + 1}] ${src.title}${link}`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Pull the last WINDOW_HOURS of enriched docs, bucket by topic, summarize
 * each topic via gpt-4o-mini, and ingest the combined brief as a new
 * brain_document (source_type='brief') so it lives inside the corpus
 * and is searchable/citable like any other doc.
 */
export async function generateDailyBrief(): Promise<BriefResult> {
  const t0 = Date.now();
  const supabase = supabaseAdmin();

  const since = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString();
  const { data: docs, error } = await supabase
    .from("brain_documents")
    .select("id,title,source_url,summary,topics,sentiment")
    .gte("created_at", since)
    .not("enriched_at", "is", null)
    .neq("source_type", "brief");
  if (error) throw new Error(`brief query failed: ${error.message}`);

  const enriched = (docs ?? []) as EnrichedDoc[];

  const groups = bucket(enriched);
  const eligible = Array.from(groups.entries())
    .filter(([, ds]) => ds.length >= MIN_DOCS_PER_TOPIC)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 8); // cap to keep the brief readable

  if (eligible.length === 0) {
    throw new Error(`no topic clusters with ≥${MIN_DOCS_PER_TOPIC} docs in the last ${WINDOW_HOURS}h`);
  }

  const summaries: TopicSummary[] = [];
  for (const [topic, ds] of eligible) {
    const sliced = ds.slice(0, 10);
    let summary = "(synthesis unavailable)";
    try {
      summary = await summarizeTopic(topic, sliced);
    } catch (err) {
      summary = `(synthesis failed: ${err instanceof Error ? err.message : "unknown"})`;
    }
    summaries.push({
      topic,
      sentiment: tallySentiment(sliced),
      docCount: sliced.length,
      summary,
      sources: sliced.map((d) => ({ id: d.id, title: d.title, sourceUrl: d.source_url })),
    });
  }

  const date = new Date().toISOString().slice(0, 10);
  const body = renderBriefMarkdown(date, summaries);

  const ingested = await ingestDocument({
    sourceType: "brief",
    title: `Daily Brief — ${date}`,
    rawText: body,
    metadata: {
      windowHours: WINDOW_HOURS,
      sourceCount: enriched.length,
      topics: summaries.map((s) => s.topic),
      perTopic: summaries.map((s) => ({
        topic: s.topic,
        docCount: s.docCount,
        sentiment: s.sentiment,
        sources: s.sources.map((src) => ({ id: src.id, title: src.title })),
      })),
    },
  });

  return {
    briefDocumentId: ingested.documentId,
    topicSummaries: summaries.length,
    sourceCount: enriched.length,
    durationMs: Date.now() - t0,
  };
}

export type LatestBrief = {
  id: string;
  title: string;
  createdAt: string;
  body: string;
  meta: {
    windowHours?: number;
    sourceCount?: number;
    topics?: string[];
    perTopic?: Array<{
      topic: string;
      docCount: number;
      sentiment: { bullish: number; bearish: number; neutral: number };
      sources: Array<{ id: string; title: string }>;
    }>;
  };
};

export async function getLatestBrief(): Promise<LatestBrief | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("brain_documents")
    .select("id,title,created_at,raw_text,metadata")
    .eq("source_type", "brief")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    title: data.title,
    createdAt: data.created_at,
    body: data.raw_text,
    meta: (data.metadata ?? {}) as LatestBrief["meta"],
  };
}
