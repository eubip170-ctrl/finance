/**
 * Price series adapter.
 *
 * The 3 new dashboard / focus / charts sections load OHLCV from MarketStack v2
 * (`./marketstack.ts`), then this module shapes them into a uniform `Series`
 * type and computes multi-period returns / SMA / EMA used by the UI.
 *
 * MarketStack v2 only exposes EOD, so we always fetch a daily window large
 * enough to cover the longest required lookback (~2y for 1Y returns plus
 * buffer for SMA50/etc).
 */

import {
  loadMultipleOhlcv,
  loadOhlcv,
  startDateDaysAgo,
  todayISO,
  type OhlcvRow,
} from "./marketstack";

export type Series = {
  symbol: string;
  timestamps: number[]; // unix seconds (UTC midnight)
  closes: number[];
  meta: {
    regularMarketPrice?: number;
    previousClose?: number;
    currency?: string;
    shortName?: string;
  };
};

const DEFAULT_LOOKBACK_DAYS = 800; // ~2y of trading days + buffer

function rowsToSeries(symbol: string, rows: OhlcvRow[]): Series | null {
  if (rows.length === 0) return null;
  const timestamps = rows.map((r) => Math.floor(new Date(r.date + "T00:00:00Z").getTime() / 1000));
  const closes = rows.map((r) => r.close);
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2] ?? last;
  return {
    symbol,
    timestamps,
    closes,
    meta: {
      regularMarketPrice: last,
      previousClose: prev,
      currency: "USD",
      shortName: undefined,
    },
  };
}

export async function getSeries(
  symbol: string,
  lookbackDays: number = DEFAULT_LOOKBACK_DAYS,
): Promise<Series | null> {
  try {
    const rows = await loadOhlcv(symbol, startDateDaysAgo(lookbackDays), todayISO());
    return rowsToSeries(symbol, rows);
  } catch {
    return null;
  }
}

export async function getManySeries(
  symbols: string[],
  lookbackDays: number = DEFAULT_LOOKBACK_DAYS,
  concurrency = 3,
): Promise<Series[]> {
  if (symbols.length === 0) return [];
  try {
    const { series } = await loadMultipleOhlcv(
      symbols,
      startDateDaysAgo(lookbackDays),
      todayISO(),
      concurrency,
    );
    const out: Series[] = [];
    for (const s of symbols) {
      const rows = series.get(s);
      if (!rows) continue;
      const r = rowsToSeries(s, rows);
      if (r) out.push(r);
    }
    return out;
  } catch {
    return [];
  }
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
