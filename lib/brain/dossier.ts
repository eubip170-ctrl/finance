import { supabaseAdmin } from "@/lib/supabase/server";
import { MODELS, completeJSON } from "@/lib/llm/openai";
import { ingestDocument } from "./ingest";

/** How far back the dossier reaches. 30 days catches enough context for
 *  most topics without diluting recency. */
const WINDOW_DAYS = 30;

const MIN_DOCS_PER_DOSSIER = 4;
const MAX_DOCS_PER_DOSSIER = 50;

export type DossierSections = {
  currentState: string;   // 3-5 sentences
  keyDrivers: string[];   // 3-6 short bullets
  sentimentNote: string;  // 1-2 sentences synthesising tone evolution
  topEntities: Array<{ name: string; kind: string; mentions: number }>;
  outlook: string;        // 2-3 sentences — what to watch
};

export type Dossier = {
  topic: string;
  windowDays: number;
  generatedAt: string;
  docCount: number;
  sentiment: { bullish: number; bearish: number; neutral: number };
  sections: DossierSections;
  sources: Array<{ id: string; title: string; sourceUrl: string | null; createdAt: string }>;
};

type EnrichedDoc = {
  id: string;
  title: string;
  source_url: string | null;
  created_at: string;
  summary: string | null;
  entities: Array<{ kind: string; value: string }> | null;
  sentiment: "bullish" | "bearish" | "neutral" | null;
};

const SYSTEM = `You are a markets-and-macro research analyst. You will be given a topic and the summaries of N recent items mentioning that topic. Produce a structured dossier in JSON exactly:

{
  "currentState": "<3-5 sentence prose: what is going on right now>",
  "keyDrivers": ["<short bullet>", "<short bullet>", ...],   // 3-6 items
  "sentimentNote": "<1-2 sentences synthesising market tone & how it has shifted>",
  "outlook": "<2-3 sentences: what to watch next, named catalysts and timeframes>"
}

Cite source indices inline in prose as [1], [2], … No markdown headers. Be concrete: name entities, numbers, dates. Avoid platitudes.`;

type DossierLLMRaw = {
  currentState?: unknown;
  keyDrivers?: unknown;
  sentimentNote?: unknown;
  outlook?: unknown;
};

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

function topEntities(docs: EnrichedDoc[], n = 10): DossierSections["topEntities"] {
  const tally = new Map<string, { name: string; kind: string; mentions: number }>();
  for (const d of docs) {
    for (const e of d.entities ?? []) {
      const key = `${e.kind}:${e.value.toLowerCase()}`;
      const cur = tally.get(key);
      if (cur) cur.mentions += 1;
      else tally.set(key, { name: e.value, kind: e.kind, mentions: 1 });
    }
  }
  return Array.from(tally.values())
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, n);
}

function renderDossierMarkdown(topic: string, d: Dossier): string {
  const lines: string[] = [];
  lines.push(`# Topic Dossier — ${topic}`);
  lines.push("");
  lines.push(
    `Synthesis of ${d.docCount} items over the last ${d.windowDays} days. ` +
      `Sentiment split: B${d.sentiment.bullish} · B${d.sentiment.bearish} · N${d.sentiment.neutral}. ` +
      `Auto-generated ${d.generatedAt.slice(0, 10)}.`,
  );
  lines.push("");
  lines.push(`## Current state`);
  lines.push("");
  lines.push(d.sections.currentState.trim());
  lines.push("");
  lines.push(`## Key drivers`);
  lines.push("");
  for (const dr of d.sections.keyDrivers) lines.push(`- ${dr.trim()}`);
  lines.push("");
  lines.push(`## Sentiment`);
  lines.push("");
  lines.push(d.sections.sentimentNote.trim());
  lines.push("");
  lines.push(`## Top entities`);
  lines.push("");
  for (const e of d.sections.topEntities) {
    lines.push(`- ${e.name} (${e.kind}) — ${e.mentions}`);
  }
  lines.push("");
  lines.push(`## Outlook`);
  lines.push("");
  lines.push(d.sections.outlook.trim());
  lines.push("");
  lines.push("## Sources");
  lines.push("");
  d.sources.forEach((s, i) => {
    const link = s.sourceUrl ? ` — ${s.sourceUrl}` : "";
    lines.push(`- [${i + 1}] ${s.title}${link}`);
  });
  return lines.join("\n");
}

export async function generateTopicDossier(topic: string): Promise<{ documentId: string; dossier: Dossier }> {
  const supabase = supabaseAdmin();

  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString();
  const { data, error } = await supabase
    .from("brain_documents")
    .select("id,title,source_url,created_at,summary,entities,sentiment,topics")
    .gte("created_at", since)
    .not("enriched_at", "is", null)
    .contains("topics", [topic])
    .order("created_at", { ascending: false })
    .limit(MAX_DOCS_PER_DOSSIER);
  if (error) throw new Error(`dossier query failed: ${error.message}`);

  const docs = (data ?? []) as EnrichedDoc[];
  if (docs.length < MIN_DOCS_PER_DOSSIER) {
    throw new Error(
      `not enough docs for topic "${topic}" (have ${docs.length}, need ≥${MIN_DOCS_PER_DOSSIER})`,
    );
  }

  const numbered = docs
    .map(
      (d, i) =>
        `[${i + 1}] ${new Date(d.created_at).toISOString().slice(0, 10)} · ${d.title.trim()} — ${d.summary?.replace(/\s+/g, " ").trim() ?? "(no summary)"}`,
    )
    .join("\n\n");

  const prompt = `Topic: ${topic}\n\nSources (most recent first, last ${WINDOW_DAYS} days):\n${numbered}`;

  const raw = await completeJSON<DossierLLMRaw>({
    model: MODELS.fast,
    system: SYSTEM,
    prompt,
    maxTokens: 900,
    temperature: 0.2,
  });

  const currentState = typeof raw.currentState === "string" ? raw.currentState.trim() : "";
  const keyDrivers = Array.isArray(raw.keyDrivers)
    ? raw.keyDrivers
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .slice(0, 6)
    : [];
  const sentimentNote = typeof raw.sentimentNote === "string" ? raw.sentimentNote.trim() : "";
  const outlook = typeof raw.outlook === "string" ? raw.outlook.trim() : "";

  const dossier: Dossier = {
    topic,
    windowDays: WINDOW_DAYS,
    generatedAt: new Date().toISOString(),
    docCount: docs.length,
    sentiment: tallySentiment(docs),
    sections: {
      currentState,
      keyDrivers,
      sentimentNote,
      topEntities: topEntities(docs, 10),
      outlook,
    },
    sources: docs.map((d) => ({
      id: d.id,
      title: d.title,
      sourceUrl: d.source_url,
      createdAt: d.created_at,
    })),
  };

  const body = renderDossierMarkdown(topic, dossier);
  const title = `Topic Dossier — ${topic}`;

  const ingested = await ingestDocument({
    sourceType: "brief", // reuse the 'brief' source_type — dossiers are AI-generated narrative
    title,
    rawText: body,
    metadata: {
      kind: "topic-dossier",
      topic,
      windowDays: WINDOW_DAYS,
      docCount: docs.length,
      sentiment: dossier.sentiment,
      topEntities: dossier.sections.topEntities,
      sources: dossier.sources.map((s) => ({ id: s.id, title: s.title })),
      sections: dossier.sections,
    },
  });

  return { documentId: ingested.documentId, dossier };
}

export async function getLatestDossier(topic: string): Promise<Dossier | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("brain_documents")
    .select("id,title,created_at,raw_text,metadata")
    .eq("source_type", "brief")
    .contains("metadata", { kind: "topic-dossier", topic })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const meta = (data.metadata ?? {}) as {
    topic?: string;
    windowDays?: number;
    docCount?: number;
    sentiment?: { bullish: number; bearish: number; neutral: number };
    topEntities?: DossierSections["topEntities"];
    sources?: Array<{ id: string; title: string }>;
    sections?: DossierSections;
  };
  return {
    topic: meta.topic ?? topic,
    windowDays: meta.windowDays ?? WINDOW_DAYS,
    generatedAt: data.created_at,
    docCount: meta.docCount ?? 0,
    sentiment: meta.sentiment ?? { bullish: 0, bearish: 0, neutral: 0 },
    sections: meta.sections ?? {
      currentState: "",
      keyDrivers: [],
      sentimentNote: "",
      topEntities: meta.topEntities ?? [],
      outlook: "",
    },
    sources: (meta.sources ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      sourceUrl: null,
      createdAt: "",
    })),
  };
}

export type TopicSummary = {
  topic: string;
  docCount: number;
  hasDossier: boolean;
  lastDossierAt: string | null;
};

export async function listTopics(): Promise<TopicSummary[]> {
  const supabase = supabaseAdmin();
  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString();
  const { data: docs, error } = await supabase
    .from("brain_documents")
    .select("topics")
    .gte("created_at", since)
    .not("enriched_at", "is", null);
  if (error) throw new Error(error.message);

  const count = new Map<string, number>();
  for (const r of (docs ?? []) as Array<{ topics: string[] | null }>) {
    for (const t of r.topics ?? []) count.set(t, (count.get(t) ?? 0) + 1);
  }

  // Fetch dossier presence in one shot — newest per topic, source_type='brief'
  const { data: dossierDocs } = await supabase
    .from("brain_documents")
    .select("created_at,metadata")
    .eq("source_type", "brief")
    .order("created_at", { ascending: false });
  const dossierByTopic = new Map<string, string>();
  for (const d of (dossierDocs ?? []) as Array<{ created_at: string; metadata: { kind?: string; topic?: string } | null }>) {
    if (d.metadata?.kind === "topic-dossier" && typeof d.metadata.topic === "string") {
      if (!dossierByTopic.has(d.metadata.topic)) {
        dossierByTopic.set(d.metadata.topic, d.created_at);
      }
    }
  }

  return Array.from(count.entries())
    .map(([topic, docCount]) => ({
      topic,
      docCount,
      hasDossier: dossierByTopic.has(topic),
      lastDossierAt: dossierByTopic.get(topic) ?? null,
    }))
    .sort((a, b) => b.docCount - a.docCount);
}
