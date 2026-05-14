/**
 * Yahoo Finance v8 historical series fetcher.
 *
 * The chart endpoint returns OHLC arrays plus closing prices for the requested
 * range/interval. We use this for sparklines, multi-period performance, and
 * the technical analysis section.
 *
 * Like `yahoo.ts` we fan out per-symbol and tolerate partial failures.
 */

const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
};

export type ChartRange = "5d" | "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "ytd";
export type ChartInterval = "1d" | "1wk" | "1mo" | "60m";

export type Series = {
  symbol: string;
  timestamps: number[];
  closes: number[];
  meta: {
    regularMarketPrice?: number;
    previousClose?: number;
    currency?: string;
    shortName?: string;
  };
};

export async function getSeries(
  symbol: string,
  range: ChartRange = "1y",
  interval: ChartInterval = "1d",
): Promise<Series | null> {
  const url = `${BASE}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  try {
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 300 } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: Array<number | null> }> };
          meta?: {
            symbol?: string;
            regularMarketPrice?: number;
            previousClose?: number;
            chartPreviousClose?: number;
            currency?: string;
            shortName?: string;
            longName?: string;
          };
        }>;
      };
    };
    const r = json.chart?.result?.[0];
    if (!r?.timestamp || !r.indicators?.quote?.[0]?.close) return null;
    const ts = r.timestamp;
    const rawCloses = r.indicators.quote[0].close ?? [];
    const timestamps: number[] = [];
    const closes: number[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = rawCloses[i];
      if (typeof c === "number" && Number.isFinite(c)) {
        timestamps.push(ts[i]);
        closes.push(c);
      }
    }
    if (closes.length === 0) return null;
    return {
      symbol: r.meta?.symbol ?? symbol,
      timestamps,
      closes,
      meta: {
        regularMarketPrice: r.meta?.regularMarketPrice,
        previousClose: r.meta?.previousClose ?? r.meta?.chartPreviousClose,
        currency: r.meta?.currency,
        shortName: r.meta?.shortName ?? r.meta?.longName,
      },
    };
  } catch {
    return null;
  }
}

export async function getManySeries(
  symbols: string[],
  range: ChartRange = "1y",
  interval: ChartInterval = "1d",
): Promise<Series[]> {
  if (symbols.length === 0) return [];
  const r = await Promise.allSettled(symbols.map((s) => getSeries(s, range, interval)));
  return r
    .map((x) => (x.status === "fulfilled" ? x.value : null))
    .filter((s): s is Series => s !== null);
}

/**
 * Return percentage change between the most recent close and the close `nBack`
 * trading days earlier. Returns null if the series is too short.
 */
export function pctChangeBack(series: Series, nBack: number): number | null {
  const n = series.closes.length;
  if (n < 2 || nBack < 1 || n - 1 - nBack < 0) return null;
  const last = series.closes[n - 1];
  const prev = series.closes[n - 1 - nBack];
  if (!prev || !Number.isFinite(prev) || prev === 0) return null;
  return ((last - prev) / prev) * 100;
}

/** YTD return: anchor on the first close of the current calendar year. */
export function pctChangeYTD(series: Series): number | null {
  if (series.closes.length < 2) return null;
  const year = new Date().getUTCFullYear();
  let anchor: number | null = null;
  for (let i = 0; i < series.timestamps.length; i++) {
    const d = new Date(series.timestamps[i] * 1000);
    if (d.getUTCFullYear() === year) {
      anchor = series.closes[i];
      break;
    }
  }
  if (anchor == null || anchor === 0) return null;
  const last = series.closes[series.closes.length - 1];
  return ((last - anchor) / anchor) * 100;
}

/** Multi-period returns (1D, 1W ≈ 5d, 1M ≈ 21d, 3M ≈ 63d, YTD, 1Y ≈ 252d). */
export function multiPeriodReturns(series: Series) {
  return {
    "1D": pctChangeBack(series, 1),
    "1W": pctChangeBack(series, 5),
    "1M": pctChangeBack(series, 21),
    "3M": pctChangeBack(series, 63),
    YTD: pctChangeYTD(series),
    "1Y": pctChangeBack(series, 252),
  };
}

/** Simple Moving Average. Returns array same length, with leading nulls. */
export function sma(values: number[], window: number): Array<number | null> {
  const out: Array<number | null> = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(i >= window - 1 ? sum / window : null);
  }
  return out;
}

/** Exponential Moving Average. */
export function ema(values: number[], window: number): Array<number | null> {
  const out: Array<number | null> = [];
  const k = 2 / (window + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < window - 1) {
      out.push(null);
      continue;
    }
    if (prev == null) {
      let s = 0;
      for (let j = i - window + 1; j <= i; j++) s += values[j];
      prev = s / window;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}
