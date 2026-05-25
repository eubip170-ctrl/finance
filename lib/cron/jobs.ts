import { supabaseAdmin } from "@/lib/supabase/server";
import { fetchAllFeeds } from "@/lib/markets/rss";
import { fetchNewsApiArticles, type NewsApiQuery } from "@/lib/markets/newsapi";
import { ingestDocument } from "@/lib/brain/ingest";

export type RssIngestResult = { fetched: number; inserted: number; skipped: number };
export type NewsApiIngestResult = {
  fetched: number;
  inserted: number;
  skipped: number;
  dedupedByHash: number;
  totalAvailable: number;
  costSearches: number;
};

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

/**
 * Pulls articles from NewsAPI.ai and ingests them into the Brain corpus.
 * Uses the API's own concepts/sentiment/categories metadata to skip the
 * gpt-4o-mini enrichment call (saves ~$0.0002/doc). The Phase-1
 * content_hash unique index makes re-ingest idempotent — pulling the same
 * batch twice silently dedupes without spending embeddings.
 *
 * Free-plan budget: 2,000 searches total. With cron every 6 hours and one
 * search per run, this lasts ~16 months.
 */
export async function runNewsApiIngest(
  opts: { query?: NewsApiQuery } = {},
): Promise<NewsApiIngestResult> {
  const got = await fetchNewsApiArticles(opts.query ?? { count: 100 });

  let inserted = 0;
  let skipped = 0;
  let dedupedByHash = 0;

  for (const a of got.articles) {
    try {
      const result = await ingestDocument({
        sourceType: "news",
        title: a.title,
        rawText: a.body,
        sourceUrl: a.url ?? undefined,
        publishedAt: a.publishedAt ?? undefined,
        metadata: {
          provider: "newsapi-ai",
          newsapi_uri: a.uri,
          source_name: a.sourceName,
          lang: a.lang,
        },
        enrichment: {
          summary: a.summary,
          entities: a.entities,
          topics: a.topics,
          sentiment: a.sentiment,
        },
      });
      if (result.deduped) dedupedByHash += 1;
      else inserted += 1;
    } catch (err) {
      console.error("newsapi ingest failed:", err instanceof Error ? err.message : err);
      skipped += 1;
    }
  }

  return {
    fetched: got.articles.length,
    inserted,
    skipped,
    dedupedByHash,
    totalAvailable: got.totalAvailable,
    costSearches: 1,
  };
}
