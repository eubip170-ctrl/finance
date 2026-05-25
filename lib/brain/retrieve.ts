import { supabaseAdmin } from "@/lib/supabase/server";
import { MODELS, completeJSON } from "@/lib/llm/openai";
import { embed } from "./embeddings";

export type RetrievedChunk = {
  id: string;
  documentId: string;
  content: string;
  /** Cosine similarity (0-1). 0 when the chunk surfaced only via BM25. */
  similarity: number;
  /** ts_rank BM25 score (≥ 0). 0 when the chunk surfaced only via vectors. */
  bm25?: number;
  /** Reciprocal-rank-fusion blended score (higher = better). */
  rrf?: number;
  /** Optional LLM rerank score in [0, 10] set by rerankChunks. */
  rerank?: number;
  metadata: Record<string, unknown>;
};

export type RetrieveOptions = {
  matchCount?: number;
  minSimilarity?: number;
  filterSource?: string | null;
  filterTopic?: string | null;
  filterSentiment?: "bullish" | "bearish" | "neutral" | null;
  filterEntity?: string | null;
};

/**
 * Legacy pure-vector retrieval. Kept so callers that don't need BM25
 * (the 3D graph builder, the news widget) don't pay the extra cost.
 */
export async function retrieve(
  query: string,
  opts: RetrieveOptions = {},
): Promise<RetrievedChunk[]> {
  const supabase = supabaseAdmin();
  const [vec] = await embed(query);
  if (!vec) return [];

  const { data, error } = await supabase.rpc("match_brain_chunks", {
    query_embedding: vec as unknown as string,
    match_count: opts.matchCount ?? 8,
    min_similarity: opts.minSimilarity ?? 0.25,
    filter_source: opts.filterSource ?? null,
  });
  if (error) throw new Error(`match_brain_chunks failed: ${error.message}`);

  return (data ?? []).map((r: {
    id: string;
    document_id: string;
    content: string;
    similarity: number;
    metadata: Record<string, unknown>;
  }) => ({
    id: r.id,
    documentId: r.document_id,
    content: r.content,
    similarity: r.similarity,
    metadata: r.metadata,
  }));
}

/**
 * Hybrid retrieval: vector cosine ⊕ Postgres BM25 (ts_rank), fused via
 * Reciprocal Rank Fusion with optional metadata pre-filters on topic /
 * sentiment / entity / source. Returns the top `matchCount` chunks ordered
 * by rrf score. Best used at K=20 then passed to rerankChunks.
 */
export async function retrieveHybrid(
  query: string,
  opts: RetrieveOptions = {},
): Promise<RetrievedChunk[]> {
  const supabase = supabaseAdmin();
  const [vec] = await embed(query);
  if (!vec) return [];

  const { data, error } = await supabase.rpc("match_brain_chunks_hybrid", {
    query_text: query,
    query_embedding: vec as unknown as string,
    match_count: opts.matchCount ?? 20,
    min_similarity: opts.minSimilarity ?? 0,
    filter_source: opts.filterSource ?? null,
    filter_topic: opts.filterTopic ?? null,
    filter_sentiment: opts.filterSentiment ?? null,
    filter_entity: opts.filterEntity ?? null,
  });
  if (error) throw new Error(`match_brain_chunks_hybrid failed: ${error.message}`);

  return (data ?? []).map((r: {
    id: string;
    document_id: string;
    content: string;
    similarity: number;
    bm25: number;
    rrf_score: number;
    metadata: Record<string, unknown>;
  }) => ({
    id: r.id,
    documentId: r.document_id,
    content: r.content,
    similarity: r.similarity,
    bm25: r.bm25,
    rrf: r.rrf_score,
    metadata: r.metadata,
  }));
}

const RERANK_SYSTEM = `You are a relevance judge for a markets-and-macro research workbench. Given a user question and N candidate excerpts, rate each excerpt 0–10 for how directly it answers the question.

Scale:
  10 — directly answers the question (numbers, decisions, named events)
   7 — strongly relevant context (same topic, useful background)
   4 — weakly relevant (mentions a related entity but not the question)
   0 — off-topic

Be strict. Most excerpts should land 4 or below. Return JSON exactly as:
{"scores":[{"idx":0,"score":7},{"idx":1,"score":2}, …]}
One entry per candidate, idx zero-based, in the same order they were given.`;

type RerankResponse = { scores?: Array<{ idx?: unknown; score?: unknown }> };

/**
 * LLM rerank pass. Sends all candidates in one gpt-4o-mini call (single
 * structured response), filters/sorts by score, returns the top `keep`.
 * Falls back to the original order if the rerank call fails or returns
 * something we can't parse — we never want to silently lose hits.
 */
export async function rerankChunks(
  query: string,
  candidates: RetrievedChunk[],
  keep = 8,
): Promise<RetrievedChunk[]> {
  if (candidates.length === 0) return [];
  if (candidates.length <= 2) return candidates.slice(0, keep);

  const numbered = candidates
    .map((c, i) => `[${i}] ${c.content.replace(/\s+/g, " ").trim().slice(0, 600)}`)
    .join("\n\n");
  const prompt = `Question:\n${query}\n\nCandidates:\n${numbered}`;

  try {
    const raw = await completeJSON<RerankResponse>({
      model: MODELS.fast,
      system: RERANK_SYSTEM,
      prompt,
      maxTokens: 500,
      temperature: 0,
    });
    if (!raw?.scores || !Array.isArray(raw.scores)) {
      return candidates.slice(0, keep);
    }
    const scored = candidates.map((c, i) => {
      const entry = raw.scores!.find((s) => Number(s.idx) === i);
      const score = typeof entry?.score === "number" ? entry.score : 0;
      return { ...c, rerank: Math.max(0, Math.min(10, score)) };
    });
    return scored
      .sort((a, b) => (b.rerank ?? 0) - (a.rerank ?? 0))
      .filter((c) => (c.rerank ?? 0) > 0)
      .slice(0, keep);
  } catch {
    return candidates.slice(0, keep);
  }
}
