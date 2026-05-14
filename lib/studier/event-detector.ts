/**
 * Event auto-detector.
 *
 * Scans recently ingested Brain documents (typically RSS items from central
 * banks, treasuries and macro news outlets) and asks the LLM to extract any
 * actual macro/geopolitical events worth analyzing. Each detected event
 * becomes a row in `events` ready for the Studier pipeline.
 *
 * Designed to be idempotent: we skip documents that already have an event
 * pointing back to them (via metadata.source_document_id).
 */

import { supabaseAdmin } from "@/lib/supabase/server";
import { MODELS, completeJSON } from "@/lib/llm/openai";

const ALLOWED_EVENT_TYPES = [
  "monetary_policy",
  "fiscal_policy",
  "geopolitical",
  "regulation",
  "macro_release",
  "corporate",
  "commodity",
  "energy",
  "other",
] as const;

type EventType = (typeof ALLOWED_EVENT_TYPES)[number];

type DetectorOutput = {
  events: Array<{
    title: string;
    summary: string;
    event_type: EventType;
    impact_score: number; // 0..1, used to gate auto-pipeline
    rationale?: string;
  }>;
};

const DETECTOR_SYSTEM = `You are a macro market analyst. Given a news item, decide whether it describes
a genuine macro / geopolitical / regulatory / monetary policy event that traders
would meaningfully analyze. Reject:
- generic market commentary or recap pieces
- corporate puff pieces with no broader macro impact
- evergreen "explainer" content
- repeats of already-known events without new information

Be strict. Quality over quantity. When in doubt, return events: [].`;

const DETECTOR_PROMPT = (title: string, body: string) => `
News item:
Title: ${title}
Body: ${body}

Return strictly JSON:
{
  "events": [
    {
      "title": "<concise canonical event title, ≤120 chars>",
      "summary": "<≤500 chars, factual, what happened, who, when, magnitude if known>",
      "event_type": "monetary_policy|fiscal_policy|geopolitical|regulation|macro_release|corporate|commodity|energy|other",
      "impact_score": 0.0,
      "rationale": "<≤200 chars, why traders care>"
    }
  ]
}

If the item is noise, return: {"events": []}
You may extract 0, 1, or rarely 2 events from a single item.
impact_score guideline: 0.9+ = FOMC/ECB rate decision, war outbreak, sanctions; 0.6-0.8 = important macro release, central bank speech; 0.3-0.5 = secondary news; <0.3 = skip.
`;

const MIN_BODY_LEN = 80;

export type DetectEventsResult = {
  scanned: number;
  created: number;
  skipped: number;
  errors: number;
};

export async function detectEventsFromBrain(opts: {
  lookbackHours?: number;
  maxDocs?: number;
  minImpactToCreate?: number;
}): Promise<DetectEventsResult> {
  const supabase = supabaseAdmin();
  const lookbackHours = opts.lookbackHours ?? 6;
  const maxDocs = opts.maxDocs ?? 25;
  const minImpact = opts.minImpactToCreate ?? 0.45;

  const since = new Date(Date.now() - lookbackHours * 3600 * 1000).toISOString();

  const { data: docs, error } = await supabase
    .from("brain_documents")
    .select("id,title,raw_text,source_url,published_at")
    .gte("created_at", since)
    .in("source_type", ["rss", "news"])
    .order("created_at", { ascending: false })
    .limit(maxDocs);
  if (error) throw new Error(`brain_documents query: ${error.message}`);
  if (!docs || docs.length === 0) {
    return { scanned: 0, created: 0, skipped: 0, errors: 0 };
  }

  // Find docs we already turned into events, so we don't repeat work.
  const docIds = docs.map((d) => d.id);
  const { data: existing } = await supabase
    .from("events")
    .select("metadata")
    .in("metadata->>source_document_id", docIds);
  const alreadyConverted = new Set(
    (existing ?? [])
      .map((e) => (e.metadata as { source_document_id?: string } | null)?.source_document_id)
      .filter(Boolean) as string[],
  );

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of docs) {
    if (alreadyConverted.has(doc.id)) {
      skipped++;
      continue;
    }
    if (!doc.raw_text || doc.raw_text.length < MIN_BODY_LEN) {
      skipped++;
      continue;
    }

    try {
      const out = await completeJSON<DetectorOutput>({
        model: MODELS.fast,
        system: DETECTOR_SYSTEM,
        prompt: DETECTOR_PROMPT(doc.title, doc.raw_text.slice(0, 2000)),
        maxTokens: 1200,
        temperature: 0.1,
      });

      const valid = (out.events ?? []).filter(
        (e) => ALLOWED_EVENT_TYPES.includes(e.event_type) && e.impact_score >= minImpact,
      );

      if (valid.length === 0) {
        skipped++;
        continue;
      }

      const rows = valid.map((e) => ({
        title: e.title.slice(0, 200),
        summary: e.summary.slice(0, 800),
        event_type: e.event_type,
        occurred_at: doc.published_at ?? null,
        source_url: doc.source_url ?? null,
        raw_text: doc.raw_text,
        status: "draft" as const,
        metadata: {
          source_document_id: doc.id,
          detector: "rss-auto-v1",
          impact_score: e.impact_score,
          rationale: e.rationale,
        },
      }));

      const { error: insErr } = await supabase.from("events").insert(rows);
      if (insErr) {
        errors++;
        console.error("event insert failed:", insErr.message);
        continue;
      }
      created += rows.length;
    } catch (err) {
      errors++;
      console.error(
        `detect failed for doc ${doc.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { scanned: docs.length, created, skipped, errors };
}

/**
 * Returns events that have not yet had a pipeline run, ordered by impact_score
 * descending. Used by the auto-pipeline cron to pick the top N.
 */
export async function listUnprocessedEvents(limit: number): Promise<
  Array<{ id: string; impact_score: number }>
> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("events")
    .select("id,metadata,status")
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`unprocessed events query: ${error.message}`);
  return (data ?? [])
    .map((e) => ({
      id: e.id,
      impact_score:
        (e.metadata as { impact_score?: number } | null)?.impact_score ?? 0.5,
    }))
    .sort((a, b) => b.impact_score - a.impact_score)
    .slice(0, limit);
}
