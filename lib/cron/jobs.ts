import { supabaseAdmin } from "@/lib/supabase/server";
import { fetchAllFeeds } from "@/lib/markets/rss";
import { ingestDocument } from "@/lib/brain/ingest";

export type RssIngestResult = { fetched: number; inserted: number; skipped: number };

/**
 * Pulls RSS feeds and ingests new items into the Second Brain. Deduplicates
 * by source_url so repeated runs are idempotent.
 */
export async function runRssIngest(opts: { maxItems?: number } = {}): Promise<RssIngestResult> {
  const maxItems = opts.maxItems ?? 60;
  const supabase = supabaseAdmin();

  const items = await fetchAllFeeds();
  const candidates = items.filter((it) => it.title && it.contentSnippet).slice(0, maxItems);

  let inserted = 0;
  let skipped = 0;

  for (const item of candidates) {
    if (!item.link) {
      skipped++;
      continue;
    }
    const { data: existing } = await supabase
      .from("brain_documents")
      .select("id")
      .eq("source_url", item.link)
      .maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }

    try {
      await ingestDocument({
        sourceType: "rss",
        title: item.title,
        rawText: `${item.title}\n\n${item.contentSnippet ?? ""}`,
        sourceUrl: item.link,
        publishedAt: item.isoDate,
        metadata: { feed: item.feedName, category: item.category },
      });
      inserted++;
    } catch (err) {
      console.error("ingest failed:", err instanceof Error ? err.message : err);
      skipped++;
    }
  }

  return { fetched: items.length, inserted, skipped };
}
