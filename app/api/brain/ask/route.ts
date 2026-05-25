import { NextResponse } from "next/server";
import { z } from "zod";
import { retrieveHybrid, rerankChunks } from "@/lib/brain/retrieve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const askSchema = z.object({
  query: z.string().min(2).max(2000),
  /** Final number of citations to feed the answer LLM (default 8). */
  matchCount: z.number().int().min(1).max(20).optional(),
  /** Pre-rerank candidate pool size (default 20). */
  candidatePool: z.number().int().min(4).max(60).optional(),
  minSimilarity: z.number().min(0).max(1).optional(),
  filterSource: z.string().nullable().optional(),
  filterTopic: z.string().nullable().optional(),
  filterSentiment: z.enum(["bullish", "bearish", "neutral"]).nullable().optional(),
  filterEntity: z.string().nullable().optional(),
});

interface Citation {
  index: number;
  chunkId: string;
  documentId: string;
  similarity: number;
  rerank?: number;
  rrf?: number;
  excerpt: string;
}

async function askOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const model = process.env.OPENAI_MODEL_FAST ?? "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content:
            "You are a macro / markets analyst. Answer the user's question using ONLY the numbered context excerpts provided. Cite sources inline as [1], [2], ... matching the excerpt numbers. If the excerpts do not cover the question, say so explicitly. Keep the answer tight (under 300 words).",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI chat completion failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return json.choices[0]?.message?.content ?? "";
}

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
    const candidates = await retrieveHybrid(parsed.data.query, {
      matchCount: parsed.data.candidatePool ?? 20,
      minSimilarity: parsed.data.minSimilarity ?? 0,
      filterSource: parsed.data.filterSource ?? null,
      filterTopic: parsed.data.filterTopic ?? null,
      filterSentiment: parsed.data.filterSentiment ?? null,
      filterEntity: parsed.data.filterEntity ?? null,
    });

    const chunks = await rerankChunks(
      parsed.data.query,
      candidates,
      parsed.data.matchCount ?? 8,
    );

    if (chunks.length === 0) {
      return NextResponse.json({
        ok: true,
        answer:
          "No relevant context found in the Second Brain corpus for that question. Try removing filters, ingesting more sources, or rephrasing.",
        citations: [] as Citation[],
        chunks: [],
        retrieval: { mode: "hybrid", candidates: candidates.length, kept: 0 },
      });
    }

    const ctx = chunks
      .map((c, i) => `[${i + 1}] ${c.content.replace(/\s+/g, " ").trim()}`)
      .join("\n\n");

    const prompt =
      `Question:\n${parsed.data.query}\n\nContext excerpts (cite inline as [N]):\n${ctx}\n\nAnswer:`;

    const answer = await askOpenAI(prompt);

    const citations: Citation[] = chunks.map((c, i) => ({
      index: i + 1,
      chunkId: c.id,
      documentId: c.documentId,
      similarity: c.similarity,
      rerank: c.rerank,
      rrf: c.rrf,
      excerpt: c.content.slice(0, 220),
    }));

    return NextResponse.json({
      ok: true,
      answer,
      citations,
      chunks,
      retrieval: { mode: "hybrid+rerank", candidates: candidates.length, kept: chunks.length },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
