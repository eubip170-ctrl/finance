import { supabaseAdmin } from "@/lib/supabase/server";
import { fetchAllFeeds } from "@/lib/markets/rss";
import { fetchNewsApiArticles, isNewsApiConfigured } from "@/lib/markets/newsapi-ai";
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

export type NewsApiIngestResult = {
  configured: boolean;
  fetched: number;
  inserted: number;
  skipped: number;
};

/**
 * Pulls macro/finance/geopolitical articles from NewsAPI.ai and ingests them
 * with source_type='news'. No-ops cleanly when NEWSAPI_AI_KEY is not set.
 */
export async function runNewsApiIngest(opts: {
  maxItems?: number;
  hoursBack?: number;
} = {}): Promise<NewsApiIngestResult> {
  if (!isNewsApiConfigured()) {
    return { configured: false, fetched: 0, inserted: 0, skipped: 0 };
  }
  const supabase = supabaseAdmin();
  const articles = await fetchNewsApiArticles({
    maxArticles: opts.maxItems ?? 80,
    hoursBack: opts.hoursBack ?? 12,
  });

  let inserted = 0;
  let skipped = 0;

  for (const a of articles) {
    if (!a.url) {
      skipped++;
      continue;
    }
    const { data: existing } = await supabase
      .from("brain_documents")
      .select("id")
      .eq("source_url", a.url)
      .maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }

    const body = a.body && a.body.length > 50 ? a.body : a.title;
    try {
      await ingestDocument({
        sourceType: "news",
        title: a.title,
        rawText: `${a.title}\n\n${body}`,
        sourceUrl: a.url,
        publishedAt: a.dateTime,
        metadata: {
          source: a.source,
          source_uri: a.sourceUri,
          lang: a.lang,
          sentiment: a.sentiment,
          provider: "newsapi.ai",
        },
      });
      inserted++;
    } catch (err) {
      console.error("newsapi ingest failed:", err instanceof Error ? err.message : err);
      skipped++;
    }
  }

  return { configured: true, fetched: articles.length, inserted, skipped };
}
