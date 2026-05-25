import { MODELS, completeJSON, completeText } from "@/lib/llm/openai";
import { rerankChunks, retrieveHybrid, type RetrievedChunk, type RetrieveOptions } from "./retrieve";

export type AskMode = "quick" | "deep";

export type AskCitation = {
  index: number;
  chunkId: string;
  documentId: string;
  similarity: number;
  rerank?: number;
  rrf?: number;
  excerpt: string;
};

export type AskTrace = {
  mode: AskMode;
  subqueries: string[];
  iterations: number;
  candidatePool: number;
  rerankedKept: number;
  confidence?: 0 | 1 | 2 | 3 | 4 | 5;
  gaps?: string[];
};

export type AskResult = {
  answer: string;
  citations: AskCitation[];
  chunks: RetrievedChunk[];
  trace: AskTrace;
};

const DECOMPOSE_SYSTEM = `You are a query planner for a markets-and-macro research assistant.

Given a user's question, decide if it requires decomposition into smaller research sub-queries:
- If the question has a single, focused answer (e.g. "what is the latest FOMC dot plot?"), return strategy "simple" and a single-item subqueries array.
- If the question contains multiple concepts (e.g. "how does the new China stimulus affect both copper and EU exporters?"), return strategy "decomposed" with 2-4 specific sub-queries, each phrased as a standalone retrieval prompt.

Sub-queries should be retrieval prompts (the kind that work well for semantic search + BM25), not LLM questions. Use precise terms, mention entities by canonical name, avoid pronouns.

Respond as JSON exactly: {"strategy": "simple" | "decomposed", "subqueries": [string, ...]}`;

type DecomposeRaw = { strategy?: unknown; subqueries?: unknown };

async function decomposeQuery(query: string): Promise<{ strategy: "simple" | "decomposed"; subqueries: string[] }> {
  try {
    const raw = await completeJSON<DecomposeRaw>({
      model: MODELS.fast,
      system: DECOMPOSE_SYSTEM,
      prompt: `Question:\n${query}`,
      maxTokens: 250,
      temperature: 0,
    });
    const strategy = raw.strategy === "decomposed" ? "decomposed" : "simple";
    const subs = Array.isArray(raw.subqueries)
      ? raw.subqueries
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .map((s) => s.trim())
          .slice(0, 4)
      : [];
    if (strategy === "decomposed" && subs.length >= 2) return { strategy, subqueries: subs };
    return { strategy: "simple", subqueries: [query] };
  } catch {
    return { strategy: "simple", subqueries: [query] };
  }
}

const ANSWER_SYSTEM = `You are a macro / markets analyst. Answer the user's question using ONLY the numbered context excerpts. Cite sources inline as [1], [2], … matching excerpt numbers. If the excerpts do not cover part of the question, state that gap explicitly. Keep the answer under 350 words and dense — no preamble, no markdown headers.`;

async function generateAnswer(query: string, chunks: RetrievedChunk[]): Promise<string> {
  const ctx = chunks
    .map((c, i) => `[${i + 1}] ${c.content.replace(/\s+/g, " ").trim()}`)
    .join("\n\n");
  const prompt = `Question:\n${query}\n\nContext excerpts (cite inline as [N]):\n${ctx}\n\nAnswer:`;
  return completeText({
    model: MODELS.fast,
    system: ANSWER_SYSTEM,
    prompt,
    maxTokens: 800,
    temperature: 0.2,
  });
}

const CRITIQUE_SYSTEM = `You are auditing an analyst's answer for completeness. You are given the original question, the answer, and the numbered evidence the answer was built on.

Return JSON:
{
  "confidence": 0..5  // 0 = answer is wrong / unsupported; 3 = adequate; 5 = thorough & well-cited
  "gaps": [string]    // concrete missing aspects; empty if none. Each gap is a SPECIFIC RETRIEVAL PROMPT we could run to fill it.
}

Be strict. If the answer cites mostly off-topic excerpts, confidence ≤ 2.
Be specific. Gap items must be searchable prompts ("US 2-year yield since Dec 2025"), not vague ("more rates data").`;

type CritiqueRaw = { confidence?: unknown; gaps?: unknown };

async function critique(query: string, answer: string, chunks: RetrievedChunk[]): Promise<{ confidence: 0 | 1 | 2 | 3 | 4 | 5; gaps: string[] }> {
  if (chunks.length === 0) return { confidence: 0, gaps: [] };
  try {
    const ctx = chunks
      .map((c, i) => `[${i + 1}] ${c.content.replace(/\s+/g, " ").trim().slice(0, 400)}`)
      .join("\n\n");
    const prompt = `Question:\n${query}\n\nAnswer:\n${answer}\n\nEvidence:\n${ctx}`;
    const raw = await completeJSON<CritiqueRaw>({
      model: MODELS.fast,
      system: CRITIQUE_SYSTEM,
      prompt,
      maxTokens: 250,
      temperature: 0,
    });
    const confRaw = typeof raw.confidence === "number" ? raw.confidence : 3;
    const confidence = Math.max(0, Math.min(5, Math.round(confRaw))) as 0 | 1 | 2 | 3 | 4 | 5;
    const gaps = Array.isArray(raw.gaps)
      ? raw.gaps
          .filter((g): g is string => typeof g === "string" && g.trim().length > 0)
          .map((g) => g.trim())
          .slice(0, 3)
      : [];
    return { confidence, gaps };
  } catch {
    return { confidence: 3, gaps: [] };
  }
}

function dedupe(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const seen = new Set<string>();
  const out: RetrievedChunk[] = [];
  for (const c of chunks) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

function mergeByRrf(chunks: RetrievedChunk[]): RetrievedChunk[] {
  // Keep chunks unique by id, preferring the entry with the higher rerank
  // (falls back to rrf, then similarity). Used when several sub-queries
  // surface the same chunk independently — it should rank higher because
  // both queries found it.
  const best = new Map<string, RetrievedChunk>();
  for (const c of chunks) {
    const prev = best.get(c.id);
    if (!prev) {
      best.set(c.id, c);
      continue;
    }
    const cScore = (c.rerank ?? 0) * 100 + (c.rrf ?? 0) * 10 + c.similarity;
    const pScore = (prev.rerank ?? 0) * 100 + (prev.rrf ?? 0) * 10 + prev.similarity;
    if (cScore > pScore) best.set(c.id, c);
  }
  return Array.from(best.values()).sort((a, b) => {
    const aScore = (a.rerank ?? 0) * 100 + (a.rrf ?? 0) * 10 + a.similarity;
    const bScore = (b.rerank ?? 0) * 100 + (b.rrf ?? 0) * 10 + b.similarity;
    return bScore - aScore;
  });
}

export type RunOptions = {
  mode?: AskMode;
  finalKeep?: number; // top-N citations fed to the answer call
  candidatePool?: number; // hybrid retrieve per sub-query
  filters?: Omit<RetrieveOptions, "matchCount" | "minSimilarity"> & { minSimilarity?: number };
};

export async function runAsk(query: string, opts: RunOptions = {}): Promise<AskResult> {
  const mode: AskMode = opts.mode ?? "quick";
  const finalKeep = opts.finalKeep ?? 8;
  const candidatePool = opts.candidatePool ?? 20;
  const baseOpts: RetrieveOptions = {
    matchCount: candidatePool,
    minSimilarity: opts.filters?.minSimilarity ?? 0,
    filterSource: opts.filters?.filterSource ?? null,
    filterTopic: opts.filters?.filterTopic ?? null,
    filterSentiment: opts.filters?.filterSentiment ?? null,
    filterEntity: opts.filters?.filterEntity ?? null,
  };

  if (mode === "quick") {
    const candidates = await retrieveHybrid(query, baseOpts);
    const ranked = await rerankChunks(query, candidates, finalKeep);
    const answer = ranked.length > 0
      ? await generateAnswer(query, ranked)
      : "No relevant context found in the Second Brain corpus for that question.";
    return {
      answer,
      citations: chunksToCitations(ranked),
      chunks: ranked,
      trace: {
        mode: "quick",
        subqueries: [query],
        iterations: 1,
        candidatePool: candidates.length,
        rerankedKept: ranked.length,
      },
    };
  }

  // Deep mode
  const { strategy, subqueries } = await decomposeQuery(query);
  let totalCandidatePool = 0;
  const allCandidates: RetrievedChunk[] = [];

  for (const sub of subqueries) {
    const got = await retrieveHybrid(sub, baseOpts);
    totalCandidatePool += got.length;
    const ranked = await rerankChunks(sub, got, Math.max(4, Math.ceil(finalKeep * 0.75)));
    allCandidates.push(...ranked);
  }

  let merged = mergeByRrf(dedupe(allCandidates)).slice(0, finalKeep);
  let answer = merged.length > 0
    ? await generateAnswer(query, merged)
    : "No relevant context found in the Second Brain corpus for that question.";
  let iterations = 1;

  const { confidence, gaps } = await critique(query, answer, merged);

  // Single optional refinement: if critique flags gaps and confidence is
  // low, run one more retrieval pass for the most pressing gap, merge
  // with existing evidence, and regenerate the answer.
  if (confidence < 3 && gaps.length > 0 && merged.length > 0) {
    iterations += 1;
    const gapQuery = gaps[0];
    const extra = await retrieveHybrid(gapQuery, baseOpts);
    totalCandidatePool += extra.length;
    const rankedExtra = await rerankChunks(gapQuery, extra, Math.max(4, Math.ceil(finalKeep * 0.5)));
    merged = mergeByRrf(dedupe([...merged, ...rankedExtra])).slice(0, finalKeep);
    answer = await generateAnswer(query, merged);
  }

  return {
    answer,
    citations: chunksToCitations(merged),
    chunks: merged,
    trace: {
      mode: "deep",
      subqueries: strategy === "decomposed" ? subqueries : [query],
      iterations,
      candidatePool: totalCandidatePool,
      rerankedKept: merged.length,
      confidence,
      gaps,
    },
  };
}

function chunksToCitations(chunks: RetrievedChunk[]): AskCitation[] {
  return chunks.map((c, i) => ({
    index: i + 1,
    chunkId: c.id,
    documentId: c.documentId,
    similarity: c.similarity,
    rerank: c.rerank,
    rrf: c.rrf,
    excerpt: c.content.slice(0, 220),
  }));
}
