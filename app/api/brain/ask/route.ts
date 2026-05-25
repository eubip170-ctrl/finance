import { NextResponse } from "next/server";
import { z } from "zod";
import { runAsk } from "@/lib/brain/ask-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const askSchema = z.object({
  query: z.string().min(2).max(2000),
  mode: z.enum(["quick", "deep"]).optional(),
  /** Final number of citations to feed the answer LLM (default 8). */
  matchCount: z.number().int().min(1).max(20).optional(),
  /** Pre-rerank candidate pool size per sub-query (default 20). */
  candidatePool: z.number().int().min(4).max(60).optional(),
  minSimilarity: z.number().min(0).max(1).optional(),
  filterSource: z.string().nullable().optional(),
  filterTopic: z.string().nullable().optional(),
  filterSentiment: z.enum(["bullish", "bearish", "neutral"]).nullable().optional(),
  filterEntity: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = askSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await runAsk(parsed.data.query, {
      mode: parsed.data.mode ?? "quick",
      finalKeep: parsed.data.matchCount ?? 8,
      candidatePool: parsed.data.candidatePool ?? 20,
      filters: {
        minSimilarity: parsed.data.minSimilarity ?? 0,
        filterSource: parsed.data.filterSource ?? null,
        filterTopic: parsed.data.filterTopic ?? null,
        filterSentiment: parsed.data.filterSentiment ?? null,
        filterEntity: parsed.data.filterEntity ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      answer: result.answer,
      citations: result.citations,
      chunks: result.chunks,
      retrieval: {
        mode: result.trace.mode === "deep" ? "deep-multistep" : "hybrid+rerank",
        candidates: result.trace.candidatePool,
        kept: result.trace.rerankedKept,
      },
      trace: result.trace,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
