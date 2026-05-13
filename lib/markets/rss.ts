import Parser from "rss-parser";

const parser = new Parser({ timeout: 8000 });

/** Default curated set — central banks, regulators, macro-relevant news. */
export const DEFAULT_FEEDS: { name: string; url: string; category: string }[] = [
  {
    name: "Federal Reserve — Press Releases",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    category: "central_bank",
  },
  {
    name: "ECB — Press Releases",
    url: "https://www.ecb.europa.eu/rss/press.html",
    category: "central_bank",
  },
  {
    name: "Bank of England — News",
    url: "https://www.bankofengland.co.uk/rss/news",
    category: "central_bank",
  },
  {
    name: "US Treasury — Press Releases",
    url: "https://home.treasury.gov/news/press-releases/feed",
    category: "treasury",
  },
  {
    name: "Reuters — Markets",
    url: "https://www.reuters.com/markets/rss",
    category: "news",
  },
  {
    name: "Financial Times — World",
    url: "https://www.ft.com/world?format=rss",
    category: "news",
  },
];

export type FeedItem = {
  feedName: string;
  category: string;
  title: string;
  link?: string;
  isoDate?: string;
  contentSnippet?: string;
  guid?: string;
};

export async function fetchFeed(url: string, feedName: string, category: string): Promise<FeedItem[]> {
  const feed = await parser.parseURL(url);
  return (feed.items ?? []).map((it) => ({
    feedName,
    category,
    title: it.title ?? "(untitled)",
    link: it.link,
    isoDate: it.isoDate,
    contentSnippet: it.contentSnippet ?? it.content,
    guid: it.guid ?? it.id ?? it.link,
  }));
}

export async function fetchAllFeeds(
  extra: { name: string; url: string; category: string }[] = [],
): Promise<FeedItem[]> {
  const envExtra = (process.env.RSS_FEEDS_EXTRA ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((url, i) => ({ name: `extra-${i + 1}`, url, category: "news" }));

  const feeds = [...DEFAULT_FEEDS, ...extra, ...envExtra];

  const results = await Promise.allSettled(
    feeds.map((f) => fetchFeed(f.url, f.name, f.category)),
  );

  return results
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .sort((a, b) => (b.isoDate ?? "").localeCompare(a.isoDate ?? ""));
}
