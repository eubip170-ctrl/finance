import { supabaseAdmin } from "@/lib/supabase/server";
import { MODELS, completeJSON } from "@/lib/llm/openai";
import { ingestDocument } from "./ingest";

/** Profiles aggregate further back than dossiers — context for an entity
 *  (a ticker, a central bank, a person) is longer-lived than a topic
 *  arc, so we look at 60 days. */
const WINDOW_DAYS = 60;
const MIN_DOCS_PER_PROFILE = 3;
const MAX_DOCS_PER_PROFILE = 60;

export type ProfileSections = {
  identity: string;       // 1-2 sentences — who / what this is
  latestActivity: string; // 3-4 sentences — what's happened recently
  themes: string[];       // 3-5 bullets
  watchPoints: string;    // 2-3 sentences — what to watch
};

export type EntityProfile = {
  name: string;
  kinds: string[];           // every kind the entity has been tagged with
  windowDays: number;
  generatedAt: string;
  docCount: number;
  sentiment: { bullish: number; bearish: number; neutral: number };
  weeklyMentions: Array<{ weekStart: string; count: number }>;
  topTopics: Array<{ topic: string; count: number }>;
  coOccurringEntities: Array<{ name: string; kind: string; count: number }>;
  sections: ProfileSections;
  sources: Array<{ id: string; title: string; sourceUrl: string | null; createdAt: string }>;
};

type EnrichedDoc = {
  id: string;
  title: string;
  source_url: string | null;
  created_at: string;
  summary: string | null;
  topics: string[] | null;
  entities: Array<{ kind: string; value: string }> | null;
  sentiment: "bullish" | "bearish" | "neutral" | null;
};

const SYSTEM = `You are a markets-and-macro research analyst building a profile of an entity (ticker, person, company, central bank, indicator, country, asset class, scheduled event). You are given the entity name and N recent news/research summaries that mention it.

Return JSON exactly:
{
  "identity": "<1-2 sentences placing the entity (role, sector, jurisdiction)>",
  "latestActivity": "<3-4 sentences synthesising recent mentions, with [N] citations>",
  "themes": ["<short bullet>", ...],  // 3-5 items, what threads keep recurring
  "watchPoints": "<2-3 sentences — what comes next, named catalysts and timeframes>"
}

Cite sources inline as [1], [2], … No markdown headers, no preamble, no quotation marks around numbers. Be specific. If sources are thin, say so directly in 'identity'.`;

type LLMRaw = {
  identity?: unknown;
  latestActivity?: unknown;
  themes?: unknown;
  watchPoints?: unknown;
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

function weeklyMentions(docs: EnrichedDoc[]): EntityProfile["weeklyMentions"] {
  // Bucket by ISO week start (Monday) in UTC. Empty weeks are skipped.
  const buckets = new Map<string, number>();
  for (const d of docs) {
    const dt = new Date(d.created_at);
    const day = dt.getUTCDay() || 7; // 1..7, Monday = 1
    const monday = new Date(dt);
    monday.setUTCDate(dt.getUTCDate() - (day - 1));
    monday.setUTCHours(0, 0, 0, 0);
    const key = monday.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries())
    .map(([weekStart, count]) => ({ weekStart, count }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

function topTopics(docs: EnrichedDoc[], n = 8): EntityProfile["topTopics"] {
  const tally = new Map<string, number>();
  for (const d of docs) {
    for (const t of d.topics ?? []) tally.set(t, (tally.get(t) ?? 0) + 1);
  }
  return Array.from(tally.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function coOccurring(
  docs: EnrichedDoc[],
  selfName: string,
  n = 10,
): EntityProfile["coOccurringEntities"] {
  const tally = new Map<string, { name: string; kind: string; count: number }>();
  const selfLower = selfName.toLowerCase();
  for (const d of docs) {
    for (const e of d.entities ?? []) {
      if (e.value.toLowerCase() === selfLower) continue;
      const key = `${e.kind}:${e.value.toLowerCase()}`;
      const cur = tally.get(key);
      if (cur) cur.count += 1;
      else tally.set(key, { name: e.value, kind: e.kind, count: 1 });
    }
  }
  return Array.from(tally.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function renderProfileMarkdown(name: string, p: EntityProfile): string {
  const lines: string[] = [];
  lines.push(`# Entity Profile — ${name}`);
  lines.push("");
  lines.push(
    `Profile of ${name} based on ${p.docCount} items over the last ${p.windowDays} days. ` +
      `Sentiment: B${p.sentiment.bullish} · B${p.sentiment.bearish} · N${p.sentiment.neutral}. ` +
      `Kinds: ${p.kinds.join(", ") || "—"}. Auto-generated ${p.generatedAt.slice(0, 10)}.`,
  );
  lines.push("");
  lines.push("## Identity");
  lines.push("");
  lines.push(p.sections.identity.trim());
  lines.push("");
  lines.push("## Latest activity");
  lines.push("");
  lines.push(p.sections.latestActivity.trim());
  lines.push("");
  lines.push("## Themes");
  lines.push("");
  for (const t of p.sections.themes) lines.push(`- ${t.trim()}`);
  lines.push("");
  lines.push("## Connections");
  lines.push("");
  for (const c of p.coOccurringEntities) lines.push(`- ${c.name} (${c.kind}) — ${c.count}`);
  lines.push("");
  lines.push("## What to watch");
  lines.push("");
  lines.push(p.sections.watchPoints.trim());
  lines.push("");
  lines.push("## Sources");
  lines.push("");
  p.sources.forEach((s, i) => {
    const link = s.sourceUrl ? ` — ${s.sourceUrl}` : "";
    lines.push(`- [${i + 1}] ${s.title}${link}`);
  });
  return lines.join("\n");
}

export async function generateEntityProfile(
  name: string,
): Promise<{ documentId: string; profile: EntityProfile }> {
  const supabase = supabaseAdmin();

  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString();
  const { data, error } = await supabase
    .from("brain_documents")
    .select("id,title,source_url,created_at,summary,topics,entities,sentiment")
    .gte("created_at", since)
    .not("enriched_at", "is", null)
    .contains("entities", [{ value: name }])
    .order("created_at", { ascending: false })
    .limit(MAX_DOCS_PER_PROFILE);
  if (error) throw new Error(`profile query failed: ${error.message}`);

  const docs = (data ?? []) as EnrichedDoc[];
  if (docs.length < MIN_DOCS_PER_PROFILE) {
    throw new Error(
      `not enough docs for entity "${name}" (have ${docs.length}, need ≥${MIN_DOCS_PER_PROFILE})`,
    );
  }

  // Collect all kinds this name has been tagged with — useful for the UI
  // even when ambiguous (e.g. "AAPL" only ever as ticker; "Powell" as
  // person, but might have been seen as central-bank too).
  const kindsSet = new Set<string>();
  for (const d of docs) {
    for (const e of d.entities ?? []) {
      if (e.value.toLowerCase() === name.toLowerCase()) kindsSet.add(e.kind);
    }
  }

  const numbered = docs
    .map(
      (d, i) =>
        `[${i + 1}] ${new Date(d.created_at).toISOString().slice(0, 10)} · ${d.title.trim()} — ${d.summary?.replace(/\s+/g, " ").trim() ?? "(no summary)"}`,
    )
    .join("\n\n");

  const prompt = `Entity: ${name}\nKinds: ${Array.from(kindsSet).join(", ") || "(unspecified)"}\n\nSources (most recent first, last ${WINDOW_DAYS} days):\n${numbered}`;

  const raw = await completeJSON<LLMRaw>({
    model: MODELS.fast,
    system: SYSTEM,
    prompt,
    maxTokens: 800,
    temperature: 0.2,
  });

  const identity = typeof raw.identity === "string" ? raw.identity.trim() : "";
  const latestActivity = typeof raw.latestActivity === "string" ? raw.latestActivity.trim() : "";
  const themes = Array.isArray(raw.themes)
    ? raw.themes
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .slice(0, 5)
    : [];
  const watchPoints = typeof raw.watchPoints === "string" ? raw.watchPoints.trim() : "";

  const profile: EntityProfile = {
    name,
    kinds: Array.from(kindsSet),
    windowDays: WINDOW_DAYS,
    generatedAt: new Date().toISOString(),
    docCount: docs.length,
    sentiment: tallySentiment(docs),
    weeklyMentions: weeklyMentions(docs),
    topTopics: topTopics(docs),
    coOccurringEntities: coOccurring(docs, name),
    sections: { identity, latestActivity, themes, watchPoints },
    sources: docs.map((d) => ({
      id: d.id,
      title: d.title,
      sourceUrl: d.source_url,
      createdAt: d.created_at,
    })),
  };

  const body = renderProfileMarkdown(name, profile);
  const title = `Entity Profile — ${name}`;

  const ingested = await ingestDocument({
    sourceType: "brief", // reuse the 'brief' bucket — same idea: AI-generated narrative ingested back
    title,
    rawText: body,
    metadata: {
      kind: "entity-profile",
      entity: name,
      kinds: profile.kinds,
      windowDays: WINDOW_DAYS,
      docCount: docs.length,
      sentiment: profile.sentiment,
      weeklyMentions: profile.weeklyMentions,
      topTopics: profile.topTopics,
      coOccurringEntities: profile.coOccurringEntities,
      sections: profile.sections,
      sources: profile.sources.map((s) => ({ id: s.id, title: s.title })),
    },
  });

  return { documentId: ingested.documentId, profile };
}

export async function getLatestProfile(name: string): Promise<EntityProfile | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("brain_documents")
    .select("id,title,created_at,raw_text,metadata")
    .eq("source_type", "brief")
    .contains("metadata", { kind: "entity-profile", entity: name })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const meta = (data.metadata ?? {}) as {
    entity?: string;
    kinds?: string[];
    windowDays?: number;
    docCount?: number;
    sentiment?: { bullish: number; bearish: number; neutral: number };
    weeklyMentions?: EntityProfile["weeklyMentions"];
    topTopics?: EntityProfile["topTopics"];
    coOccurringEntities?: EntityProfile["coOccurringEntities"];
    sections?: ProfileSections;
    sources?: Array<{ id: string; title: string }>;
  };

  return {
    name: meta.entity ?? name,
    kinds: meta.kinds ?? [],
    windowDays: meta.windowDays ?? WINDOW_DAYS,
    generatedAt: data.created_at,
    docCount: meta.docCount ?? 0,
    sentiment: meta.sentiment ?? { bullish: 0, bearish: 0, neutral: 0 },
    weeklyMentions: meta.weeklyMentions ?? [],
    topTopics: meta.topTopics ?? [],
    coOccurringEntities: meta.coOccurringEntities ?? [],
    sections: meta.sections ?? {
      identity: "",
      latestActivity: "",
      themes: [],
      watchPoints: "",
    },
    sources: (meta.sources ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      sourceUrl: null,
      createdAt: "",
    })),
  };
}

export type EntitySummary = {
  name: string;
  kind: string;
  mentions: number;
  hasProfile: boolean;
  lastProfileAt: string | null;
};

export async function listEntities(limit = 100): Promise<EntitySummary[]> {
  const supabase = supabaseAdmin();
  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString();
  const { data, error } = await supabase
    .from("brain_documents")
    .select("entities")
    .gte("created_at", since)
    .not("enriched_at", "is", null);
  if (error) throw new Error(error.message);

  const tally = new Map<string, { name: string; kind: string; mentions: number }>();
  for (const r of (data ?? []) as Array<{ entities: Array<{ kind: string; value: string }> | null }>) {
    for (const e of r.entities ?? []) {
      const key = `${e.kind}:${e.value.toLowerCase()}`;
      const cur = tally.get(key);
      if (cur) cur.mentions += 1;
      else tally.set(key, { name: e.value, kind: e.kind, mentions: 1 });
    }
  }

  const { data: profileDocs } = await supabase
    .from("brain_documents")
    .select("created_at,metadata")
    .eq("source_type", "brief")
    .order("created_at", { ascending: false });
  const profileByName = new Map<string, string>();
  for (const d of (profileDocs ?? []) as Array<{ created_at: string; metadata: { kind?: string; entity?: string } | null }>) {
    if (d.metadata?.kind === "entity-profile" && typeof d.metadata.entity === "string") {
      const k = d.metadata.entity.toLowerCase();
      if (!profileByName.has(k)) profileByName.set(k, d.created_at);
    }
  }

  return Array.from(tally.values())
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, limit)
    .map((e) => ({
      name: e.name,
      kind: e.kind,
      mentions: e.mentions,
      hasProfile: profileByName.has(e.name.toLowerCase()),
      lastProfileAt: profileByName.get(e.name.toLowerCase()) ?? null,
    }));
}
