/**
 * NewsAPI.ai (Event Registry) client.
 * Docs: https://newsapi.ai/documentation
 *
 * Free tier allows ~3000 requests/month for non-commercial use.
 * Set NEWSAPI_AI_KEY env var; if absent, this module is inert.
 *
 * We focus on macro / finance / geopolitical coverage by combining category
 * filters with keyword fallback. The endpoint returns deduped articles with
 * source attribution, body text, language, sentiment, and publish date.
 */

const ENDPOINT = "https://eventregistry.org/api/v1/article/getArticles";

export type NewsArticle = {
  uri: string;
  title: string;
  body: string;
  url: string;
  source: string;
  sourceUri: string;
  dateTime: string; // ISO
  lang: string;
  sentiment: number | null;
  image?: string | null;
};

type RawArticle = {
  uri?: string;
  title?: string;
  body?: string;
  url?: string;
  source?: { title?: string; uri?: string };
  dateTime?: string;
  dateTimePub?: string;
  lang?: string;
  sentiment?: number | null;
  image?: string | null;
};

export type FetchOpts = {
  maxArticles?: number;
  languages?: string[]; // e.g. ["eng", "ita"]
  keywords?: string[]; // OR-ed
  categories?: string[]; // category URIs to include
  hoursBack?: number; // restrict to last N hours; default 24
};

const DEFAULT_KEYWORDS = [
  "central bank",
  "monetary policy",
  "interest rates",
  "inflation",
  "geopolitical",
  "sanctions",
  "fiscal policy",
  "sovereign debt",
  "Federal Reserve",
  "European Central Bank",
  "FOMC",
  "ECB",
  "oil price",
  "commodities",
];

const DEFAULT_CATEGORIES = [
  "dmoz/Business",
  "dmoz/Business/Financial_Services",
  "dmoz/Business/Investing",
  "dmoz/Society/Politics",
  "dmoz/Society/Government",
];

export function isNewsApiConfigured(): boolean {
  return !!process.env.NEWSAPI_AI_KEY;
}

/**
 * Fetches recent macro/finance/geopolitical articles from NewsAPI.ai.
 * Returns [] if NEWSAPI_AI_KEY is not set (so callers can no-op gracefully).
 */
export async function fetchNewsApiArticles(opts: FetchOpts = {}): Promise<NewsArticle[]> {
  const apiKey = process.env.NEWSAPI_AI_KEY;
  if (!apiKey) return [];

  const maxArticles = Math.min(opts.maxArticles ?? 60, 100);
  const languages = opts.languages ?? ["eng"];
  const keywords = opts.keywords ?? DEFAULT_KEYWORDS;
  const categories = opts.categories ?? DEFAULT_CATEGORIES;
  const hoursBack = opts.hoursBack ?? 24;

  const dateStart = new Date(Date.now() - hoursBack * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  const query = {
    $query: {
      $and: [
        { lang: languages },
        { dateStart, dateEnd: new Date().toISOString().slice(0, 10) },
        {
          $or: [
            ...keywords.map((k) => ({ keyword: k })),
            ...categories.map((c) => ({ categoryUri: c })),
          ],
        },
      ],
    },
  };

  const body = {
    query,
    resultType: "articles",
    articlesPage: 1,
    articlesCount: maxArticles,
    articlesSortBy: "date",
    articlesSortByAsc: false,
    dataType: ["news"],
    apiKey,
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NewsAPI.ai failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    articles?: { results?: RawArticle[]; totalResults?: number };
    error?: string;
  };
  if (json.error) throw new Error(`NewsAPI.ai error: ${json.error}`);
  const results = json.articles?.results ?? [];

  return results
    .filter((r) => r.title && r.url)
    .map((r) => ({
      uri: r.uri ?? r.url ?? "",
      title: r.title ?? "(untitled)",
      body: (r.body ?? "").trim(),
      url: r.url ?? "",
      source: r.source?.title ?? "unknown",
      sourceUri: r.source?.uri ?? "",
      dateTime: r.dateTime ?? r.dateTimePub ?? new Date().toISOString(),
      lang: r.lang ?? "eng",
      sentiment: typeof r.sentiment === "number" ? r.sentiment : null,
      image: r.image ?? null,
    }));
}
