/**
 * Yahoo Finance client.
 *
 * We use the v8 chart endpoint (`/v8/finance/chart/{SYMBOL}`) instead of v7
 * `/v7/finance/quote` because:
 *   - v7 requires a "crumb" cookie since 2024 and is heavily rate-limited from
 *     cloud IP ranges (returns 429 on Vercel).
 *   - v8 chart is unauthenticated, more permissive, and exposes the live
 *     regularMarketPrice / previousClose / change% in `chart.result[0].meta`.
 *
 * We fan out one fetch per symbol (Yahoo allows this in parallel) and tolerate
 * per-symbol failures so the dashboard degrades gracefully when one ticker
 * misbehaves.
 */

const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
};

export type Quote = {
  symbol: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketTime?: Date;
  currency?: string;
  marketCap?: number;
};

async function fetchOne(symbol: string): Promise<Quote | null> {
  const url = `${BASE}/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: HEADERS,
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        meta?: {
          symbol?: string;
          regularMarketPrice?: number;
          chartPreviousClose?: number;
          previousClose?: number;
          regularMarketTime?: number;
          currency?: string;
          longName?: string;
          shortName?: string;
          marketCap?: number;
        };
      }>;
      error?: { code?: string; description?: string } | null;
    };
  };
  const meta = json.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") return null;
  const prev = meta.previousClose ?? meta.chartPreviousClose;
  const changePct =
    typeof prev === "number" && prev !== 0
      ? ((meta.regularMarketPrice - prev) / prev) * 100
      : undefined;
  return {
    symbol: meta.symbol ?? symbol,
    shortName: meta.shortName ?? meta.longName,
    regularMarketPrice: meta.regularMarketPrice,
    regularMarketChangePercent: changePct,
    regularMarketTime:
      typeof meta.regularMarketTime === "number"
        ? new Date(meta.regularMarketTime * 1000)
        : undefined,
    currency: meta.currency,
    marketCap: meta.marketCap,
  };
}

export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  if (symbols.length === 0) return [];
  const results = await Promise.allSettled(symbols.map(fetchOne));
  return results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((q): q is Quote => q !== null);
}
