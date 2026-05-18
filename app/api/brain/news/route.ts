import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 30) || 30, 100);
  const source = url.searchParams.get("source") ?? "";
  const sinceDays = Math.min(Number(url.searchParams.get("sinceDays") ?? 7) || 7, 30);
  const sinceISO = new Date(Date.now() - sinceDays * 86400_000).toISOString();

  try {
    const supabase = supabaseAdmin();
    let qb = supabase
      .from("brain_documents")
      .select("id,title,source_type,source_url,published_at,created_at,metadata")
      .in("source_type", ["rss", "news"])
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (source) {
      // metadata.feed_name lives inside the JSONB blob; filter via -> for jsonb.
      qb = qb.filter("metadata->>feed_name", "eq", source);
    }
    const { data, error } = await qb;
    if (error) throw new Error(error.message);

    type Row = {
      id: string;
      title: string;
      source_type: string;
      source_url: string | null;
      published_at: string | null;
      created_at: string;
      metadata: Record<string, unknown> | null;
    };

    const items = ((data ?? []) as Row[]).map((d) => ({
      id: d.id,
      title: d.title,
      source: (d.metadata?.feed_name as string | undefined) ?? d.source_type,
      url: d.source_url,
      publishedAt: d.published_at ?? d.created_at,
      createdAt: d.created_at,
    }));

    // Collect distinct feed names for the filter chips.
    const sourcesSet = new Set<string>();
    for (const i of items) if (i.source) sourcesSet.add(i.source);

    return NextResponse.json({
      items,
      sources: Array.from(sourcesSet).sort(),
      total: items.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
