/**
 * NewsAPI.ai (Event Registry) client.
 *
 * The API returns articles already enriched with concepts (named entities),
 * categories, sentiment, and language detection — so we can map those into
 * the Phase-1 enrichment columns without a single OpenAI call. That's the
 * whole reason we picked this provider over a plain RSS aggregator.
 *
 * Free-plan budget on this account: 2,000 searches lifetime. The cron is
 * configured at every-6-hours so the budget lasts ~16 months.
 */

import {
  canonicalizeTopic,
  type Entity,
  type EntityKind,
  type Sentiment,
} from "@/lib/brain/taxonomy";

const BASE = "https://eventregistry.org/api/v1/article/getArticles";

export type NewsApiQuery = {
  /** ISO-639-3 codes, e.g. ["eng", "ita"]. */
  lang?: string[];
  /** Max articles per response. NewsAPI caps it at 100 for free plans. */
  count?: number;
  /** Pagination — 1-indexed. */
  page?: number;
  /** Hard date floor in YYYY-MM-DD (UTC). Articles older than this are dropped. */
  dateStart?: string;
  /** "date" returns newest first. */
  sortBy?: "date" | "rel" | "sourceImportance" | "socialScore";
  /** DMOZ-style category filter, e.g. "dmoz/Business" — restricts the corpus. */
  categoryUri?: string;
  /** Free-text keyword. Empty = corpus-wide. */
  keyword?: string;
};

/** Raw shape NewsAPI.ai returns for an article. */
type RawArticle = {
  uri: string;
  lang?: string;
  isDuplicate?: boolean;
  dateTime?: string;
  url?: string;
  title?: string;
  body?: string;
  source?: { uri?: string; title?: string; dataType?: string };
  concepts?: Array<{
    uri?: string;
    label?: { eng?: string; ita?: string } | string;
    type?: string;
    score?: number;
  }>;
  categories?: Array<{ uri?: string; label?: string; wgt?: number }>;
  sentiment?: number | null;
};

type RawResponse = {
  articles?: {
    results?: RawArticle[];
    totalResults?: number;
    page?: number;
    count?: number;
    pages?: number;
  };
  error?: string;
};

/** Articles already mapped to our Brain ingest shape. */
export type NewsApiArticle = {
  uri: string;
  title: string;
  body: string;
  url: string | null;
  publishedAt: string | null;
  sourceName: string | null;
  lang: string;
  sentiment: Sentiment;
  entities: Entity[];
  topics: string[];
  summary: string;
};

function getApiKey(): string {
  const k = process.env.NEWSAPI_AI_KEY;
  if (!k) throw new Error("NEWSAPI_AI_KEY is not set on the deploy.");
  return k;
}

function clean(s: string | undefined | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** Cheap summary fallback when we don't want to spend an LLM call: take the
 *  first ~3 sentences of the body, capped at ~400 chars. Financial news
 *  ledes are usually self-contained, so this works well enough for the
 *  Library row preview. */
function deriveSummary(body: string): string {
  const text = clean(body);
  if (!text) return "";
  // Split on sentence-ish boundaries while keeping the punctuation.
  const parts = text.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÿ])/).slice(0, 3);
  const joined = parts.join(" ").trim();
  return joined.length > 420 ? joined.slice(0, 420) + " …" : joined;
}

function mapSentiment(n: number | null | undefined): Sentiment {
  if (typeof n !== "number" || Number.isNaN(n)) return "neutral";
  if (n >= 0.15) return "bullish";
  if (n <= -0.15) return "bearish";
  return "neutral";
}

/** NewsAPI concept types are: person · org · loc · wiki. Map them onto our
 *  taxonomy of EntityKind, falling back to "company" / "country" / "indicator"
 *  via simple heuristics on the label. */
function mapConceptKind(type: string | undefined, label: string): EntityKind {
  if (type === "person") return "person";
  if (type === "loc") return "country";
  if (type === "org") {
    const l = label.toLowerCase();
    if (
      /(federal reserve|fed|ecb|bank of (england|japan|canada)|pboc|rbi|rba|snb|riksbank|bcb)/.test(l)
    ) {
      return "central-bank";
    }
    return "company";
  }
  // type "wiki" or unknown: try to classify
  const l = label.toLowerCase();
  if (/(cpi|ppi|nfp|payrolls|gdp|ism|pmi)/.test(l)) return "indicator";
  if (/(fomc|ecb meeting|election)/.test(l)) return "event";
  return "company";
}

const TICKER_RE = /^[A-Z]{1,5}(?:\.[A-Z]{1,3})?$/;

function buildEntities(concepts: RawArticle["concepts"]): Entity[] {
  if (!concepts) return [];
  const out: Entity[] = [];
  const seen = new Set<string>();
  for (const c of concepts) {
    const labelObj = c.label;
    const label =
      typeof labelObj === "string"
        ? labelObj
        : labelObj?.eng ?? labelObj?.ita ?? "";
    const cleanLabel = clean(label);
    if (!cleanLabel || cleanLabel.length > 100) continue;
    if ((c.score ?? 0) < 2) continue; // skip weakly-mentioned concepts
    let kind = mapConceptKind(c.type, cleanLabel);
    // If the label looks like a stock ticker (e.g. "AAPL"), force the kind.
    if (TICKER_RE.test(cleanLabel)) kind = "ticker";
    const key = `${kind}:${cleanLabel.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind, value: cleanLabel });
    if (out.length >= 25) break;
  }
  return out;
}

/** Map a NewsAPI category URI (DMOZ-style path) onto our controlled topic
 *  vocab. Best-effort — when no mapping fits, drop it. */
function mapCategoryToTopics(categories: RawArticle["categories"]): string[] {
  if (!categories) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of categories.slice(0, 6)) {
    const uri = (c.uri ?? "").toLowerCase();
    const candidates: string[] = [];
    if (uri.includes("business/investing") || uri.includes("business/financial_services")) {
      candidates.push("equities", "credit");
    }
    if (uri.includes("business/banking") || uri.includes("financial_services/banking")) {
      candidates.push("financials", "central-banks");
    }
    if (uri.includes("business/economics") || uri.includes("economics")) {
      candidates.push("growth", "inflation");
    }
    if (uri.includes("business/commodities") || uri.includes("energy/oil") || uri.includes("oil")) {
      candidates.push("commodities", "oil");
    }
    if (uri.includes("technology") || uri.includes("computers")) {
      candidates.push("tech");
    }
    if (uri.includes("health")) candidates.push("healthcare");
    if (uri.includes("real_estate")) candidates.push("real-estate");
    if (uri.includes("politics") || uri.includes("government")) candidates.push("geopolitics");
    if (uri.includes("regional/europe")) candidates.push("europe");
    if (uri.includes("regional/asia/china")) candidates.push("china");
    if (uri.includes("regional/north_america/united_states")) candidates.push("us");
    if (uri.includes("regional/asia/japan")) candidates.push("japan");
    for (const cand of candidates) {
      const c2 = canonicalizeTopic(cand);
      if (c2 && !seen.has(c2)) {
        seen.add(c2);
        out.push(c2);
        if (out.length >= 5) break;
      }
    }
    if (out.length >= 5) break;
  }
  return out;
}

function mapArticle(r: RawArticle): NewsApiArticle | null {
  const title = clean(r.title);
  const body = clean(r.body);
  if (!title || !body) return null;
  const publishedAt = r.dateTime ?? null;
  const lang = r.lang ?? "eng";
  return {
    uri: r.uri,
    title,
    body,
    url: r.url ?? null,
    publishedAt,
    sourceName: clean(r.source?.title ?? "") || null,
    lang,
    sentiment: mapSentiment(r.sentiment ?? null),
    entities: buildEntities(r.concepts),
    topics: mapCategoryToTopics(r.categories),
    summary: deriveSummary(body),
  };
}

/**
 * Single call to NewsAPI.ai. Returns mapped articles + meta about the result.
 * Caller is responsible for de-dup against the Brain corpus (we rely on the
 * Phase-1 content_hash for that, so duplicates ingest cheaply).
 */
export async function fetchNewsApiArticles(
  q: NewsApiQuery = {},
): Promise<{ articles: NewsApiArticle[]; totalAvailable: number; page: number; pages: number }> {
  const apiKey = getApiKey();
  const body = {
    action: "getArticles",
    keyword: q.keyword ?? "",
    lang: q.lang ?? ["eng", "ita"],
    articlesPage: q.page ?? 1,
    articlesCount: Math.min(Math.max(1, q.count ?? 100), 100),
    articlesSortBy: q.sortBy ?? "date",
    articlesArticleBodyLen: -1,
    resultType: "articles",
    categoryUri: q.categoryUri ?? undefined,
    dateStart: q.dateStart ?? undefined,
    apiKey,
  };

  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`NewsAPI.ai HTTP ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as RawResponse;
  if (json.error) throw new Error(`NewsAPI.ai error: ${json.error}`);

  const raw = json.articles?.results ?? [];
  const articles = raw
    .filter((r) => !r.isDuplicate)
    .map(mapArticle)
    .filter((a): a is NewsApiArticle => a != null);

  return {
    articles,
    totalAvailable: json.articles?.totalResults ?? articles.length,
    page: json.articles?.page ?? body.articlesPage,
    pages: json.articles?.pages ?? 1,
  };
}
