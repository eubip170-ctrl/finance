/**
 * Thin Yahoo Finance client using their public quote endpoint.
 *
 * We avoid the npm `yahoo-finance2` package because it ships Deno-only test
 * modules in the published tree that break Next.js' webpack build. The endpoint
 * used here is the one consumed by yahoo.com's own widgets — no auth, no key.
 */

const QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

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
  const url = `${QUOTE_URL}?symbols=${encodeURIComponent(symbols.join(","))}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`yahoo quote failed: ${res.status}`);
  const json = (await res.json()) as {
    quoteResponse?: { result?: Array<Record<string, unknown>> };
  };
  const rows = json.quoteResponse?.result ?? [];
  return rows.map((q) => ({
    symbol: String(q.symbol ?? ""),
    shortName: (q.shortName as string) ?? (q.longName as string) ?? undefined,
    regularMarketPrice: q.regularMarketPrice as number | undefined,
    regularMarketChangePercent: q.regularMarketChangePercent as number | undefined,
    regularMarketTime:
      typeof q.regularMarketTime === "number"
        ? new Date((q.regularMarketTime as number) * 1000)
        : undefined,
    currency: q.currency as string | undefined,
    marketCap: q.marketCap as number | undefined,
  }));
}
