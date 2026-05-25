import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BrainStats {
  totals: {
    docs: number;
    chunks: number;
    sources: number;
    chunksWithEmbedding: number;
    chunksWithoutEmbedding: number;
    docsEnriched: number;
    docsUnenriched: number;
  };
  bySource: Array<{ source: string; count: number }>;
  byTopic: Array<{ topic: string; count: number }>;
  bySentiment: Array<{ sentiment: "bullish" | "bearish" | "neutral"; count: number }>;
  ingestTimeline: Array<{ date: string; count: number }>;
  recent: Array<{
    id: string;
    title: string;
    source_type: string;
    source_url: string | null;
    created_at: string;
  }>;
  quality: {
    avgChunksPerDoc: number;
    embeddingDim: number;
    embeddingModel: string;
  };
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = supabaseAdmin();

    const [
      docCountRes,
      chunkCountRes,
      allSourcesRes,
      recentRes,
      chunksWithEmbRes,
      last30Res,
      enrichedRes,
      topicsRes,
      sentimentRes,
    ] = await Promise.all([
      supabase.from("brain_documents").select("*", { count: "exact", head: true }),
      supabase.from("brain_chunks").select("*", { count: "exact", head: true }),
      supabase.from("brain_documents").select("source_type"),
      supabase
        .from("brain_documents")
        .select("id,title,source_type,source_url,created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("brain_chunks")
        .select("*", { count: "exact", head: true })
        .not("embedding", "is", null),
      supabase
        .from("brain_documents")
        .select("created_at")
        .gte("created_at", new Date(Date.now() - 30 * 86400_000).toISOString()),
      supabase
        .from("brain_documents")
        .select("*", { count: "exact", head: true })
        .not("enriched_at", "is", null),
      supabase.from("brain_documents").select("topics").not("enriched_at", "is", null),
      supabase.from("brain_documents").select("sentiment").not("sentiment", "is", null),
    ]);

    const bySourceMap: Record<string, number> = {};
    for (const r of (allSourcesRes.data ?? []) as Array<{ source_type: string }>) {
      bySourceMap[r.source_type] = (bySourceMap[r.source_type] ?? 0) + 1;
    }
    const bySource = Object.entries(bySourceMap)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    // 30-day ingest timeline, day-bucketed UTC.
    const buckets: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      buckets[d] = 0;
    }
    for (const r of (last30Res.data ?? []) as Array<{ created_at: string }>) {
      const k = r.created_at.slice(0, 10);
      if (k in buckets) buckets[k] += 1;
    }
    const ingestTimeline = Object.entries(buckets).map(([date, count]) => ({ date, count }));

    const totalChunks = chunkCountRes.count ?? 0;
    const withEmb = chunksWithEmbRes.count ?? 0;
    const totalDocs = docCountRes.count ?? 0;
    const avgChunks = totalDocs === 0 ? 0 : Math.round((totalChunks / totalDocs) * 10) / 10;

    // Topic histogram (flattening the per-row topics arrays)
    const topicCount: Record<string, number> = {};
    for (const r of (topicsRes.data ?? []) as Array<{ topics: string[] | null }>) {
      for (const t of r.topics ?? []) topicCount[t] = (topicCount[t] ?? 0) + 1;
    }
    const byTopic = Object.entries(topicCount)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 24);

    const sentimentCount: Record<"bullish" | "bearish" | "neutral", number> = {
      bullish: 0,
      bearish: 0,
      neutral: 0,
    };
    for (const r of (sentimentRes.data ?? []) as Array<{
      sentiment: "bullish" | "bearish" | "neutral";
    }>) {
      sentimentCount[r.sentiment] = (sentimentCount[r.sentiment] ?? 0) + 1;
    }
    const bySentiment = (Object.entries(sentimentCount) as Array<
      ["bullish" | "bearish" | "neutral", number]
    >).map(([sentiment, count]) => ({ sentiment, count }));

    const docsEnriched = enrichedRes.count ?? 0;
    const stats: BrainStats = {
      totals: {
        docs: totalDocs,
        chunks: totalChunks,
        sources: bySource.length,
        chunksWithEmbedding: withEmb,
        chunksWithoutEmbedding: Math.max(0, totalChunks - withEmb),
        docsEnriched,
        docsUnenriched: Math.max(0, totalDocs - docsEnriched),
      },
      bySource,
      byTopic,
      bySentiment,
      ingestTimeline,
      recent: (recentRes.data ?? []) as BrainStats["recent"],
      quality: {
        avgChunksPerDoc: avgChunks,
        embeddingDim: 1024,
        embeddingModel:
          (process.env.EMBEDDINGS_PROVIDER ?? "openai") === "voyage"
            ? "voyage-3"
            : "text-embedding-3-small",
      },
    };

    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
