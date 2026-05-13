import yahooFinance from "yahoo-finance2";

// yahoo-finance2 prints a noisy notice on first use — silence it.
yahooFinance.suppressNotices(["yahooSurvey"]);

export type Quote = {
  symbol: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketTime?: Date;
  currency?: string;
  marketCap?: number;
};

export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  if (symbols.length === 0) return [];
  const res = await yahooFinance.quote(symbols, { return: "array" });
  return res.map((q) => ({
    symbol: q.symbol,
    shortName: q.shortName ?? q.longName,
    regularMarketPrice: q.regularMarketPrice,
    regularMarketChangePercent: q.regularMarketChangePercent,
    regularMarketTime: q.regularMarketTime instanceof Date ? q.regularMarketTime : undefined,
    currency: q.currency,
    marketCap: q.marketCap,
  }));
}

export type HistoryPoint = {
  date: Date;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

export async function getHistory(
  symbol: string,
  opts: { from: Date; to?: Date; interval?: "1d" | "1wk" | "1mo" } = {
    from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  },
): Promise<HistoryPoint[]> {
  const result = await yahooFinance.chart(symbol, {
    period1: opts.from,
    period2: opts.to ?? new Date(),
    interval: opts.interval ?? "1d",
  });
  return result.quotes.map((q) => ({
    date: q.date,
    open: q.open ?? null,
    high: q.high ?? null,
    low: q.low ?? null,
    close: q.close ?? null,
    volume: q.volume ?? null,
  }));
}

export async function search(query: string, count = 10) {
  return yahooFinance.search(query, { quotesCount: count, newsCount: 0 });
}
