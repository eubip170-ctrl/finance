/**
 * MarketStack v2 client — EOD OHLCV.
 *
 * Mirrors the medge `loadOhlcv` / `loadMultipleClose` shape:
 *   - GET https://api.marketstack.com/v2/eod
 *   - 1000-row pagination via `offset`, sort=ASC
 *   - prefers adjusted prices when available
 *   - fan-out parallelism with concurrency cap and per-ticker error isolation
 *   - distinguishes fatal API errors (auth, quota) from per-ticker recoverable
 *     ones (missing data, invalid symbol) so the UI can degrade gracefully.
 *
 * MarketStack v2 only exposes EOD on the free tier, so this is daily-only.
 */

const BASE = "https://api.marketstack.com/v2";
const PAGE_LIMIT = 1000;
const NETWORK_RETRY_MAX = 6;
// 24 × jittered exponential backoff capped at 8s ≈ up to ~2 min of retry per
// request before giving up on rate-limit. Free / Basic tiers throttle per
// second, so spurious 429s in a burst are common; the longer budget keeps a
// single throttled ticker from poisoning the whole batch.
const RATE_LIMIT_RETRY_MAX = 24;
const RETRY_BASE_MS = 500;
const RETRY_MAX_MS = 8000;

const FATAL_CODES = new Set([
  "invalid_access_key",
  "missing_access_key",
  "inactive_user",
  "https_access_restricted",
  "function_access_restricted",
  "usage_limit_reached",
  "api_deactivated",
]);

export class MarketstackFatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketstackFatalError";
  }
}

export type OhlcvRow = {
  date: string; // ISO date YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function getApiKey(): string {
  const k = process.env.MARKETSTACK_API_KEY;
  if (!k) {
    throw new MarketstackFatalError(
      "MARKETSTACK_API_KEY is not set. Add it to .env.local or Vercel env.",
    );
  }
  return k;
}

function jitter(ms: number) {
  return ms * (0.7 + Math.random() * 0.6);
}

async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

type RawRow = {
  date?: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
  adj_open?: number | null;
  adj_high?: number | null;
  adj_low?: number | null;
  adj_close?: number | null;
  adj_volume?: number | null;
};

type EodResponse = {
  error?: { code?: string; message?: string };
  pagination?: { limit: number; offset: number; count: number; total: number };
  data?: RawRow[];
};

async function callEod(params: Record<string, string | number>): Promise<EodResponse> {
  const apiKey = getApiKey();
  const url = new URL(`${BASE}/eod`);
  url.searchParams.set("access_key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  let netRetries = 0;
  let rateRetries = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        next: { revalidate: 600 },
      });
    } catch (err) {
      if (netRetries >= NETWORK_RETRY_MAX) throw err;
      const wait = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** netRetries);
      netRetries++;
      await sleep(jitter(wait));
      continue;
    }

    if (res.status === 401 || res.status === 403) {
      throw new MarketstackFatalError(
        `MarketStack returned ${res.status}. Check MARKETSTACK_API_KEY.`,
      );
    }

    if (res.status === 429) {
      if (rateRetries >= RATE_LIMIT_RETRY_MAX) {
        throw new MarketstackFatalError("MarketStack rate-limit budget exhausted.");
      }
      const wait = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** rateRetries);
      rateRetries++;
      await sleep(jitter(wait));
      continue;
    }

    if (!res.ok) {
      if (netRetries >= NETWORK_RETRY_MAX) {
        throw new Error(`MarketStack HTTP ${res.status}`);
      }
      const wait = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** netRetries);
      netRetries++;
      await sleep(jitter(wait));
      continue;
    }

    const json = (await res.json()) as EodResponse;
    if (json.error?.code && FATAL_CODES.has(json.error.code)) {
      throw new MarketstackFatalError(
        `MarketStack fatal error: ${json.error.code} — ${json.error.message ?? ""}`,
      );
    }
    return json;
  }
}

/**
 * Load full EOD OHLCV series for a single ticker, paginating until exhausted.
 * Prefers adjusted prices when present.
 */
export async function loadOhlcv(
  ticker: string,
  start: string,
  end: string,
): Promise<OhlcvRow[]> {
  const rows: OhlcvRow[] = [];
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const resp = await callEod({
      symbols: ticker,
      date_from: start,
      date_to: end,
      limit: PAGE_LIMIT,
      offset,
      sort: "ASC",
    });
    const batch = resp.data ?? [];
    for (const r of batch) {
      const close = numOr(r.adj_close, r.close);
      if (close == null || !Number.isFinite(close)) continue;
      const open = numOr(r.adj_open, r.open) ?? close;
      const high = numOr(r.adj_high, r.high) ?? close;
      const low = numOr(r.adj_low, r.low) ?? close;
      const volume = numOr(r.adj_volume, r.volume) ?? 0;
      if (!r.date) continue;
      rows.push({
        date: r.date.slice(0, 10),
        open,
        high,
        low,
        close,
        volume,
      });
    }
    const total = resp.pagination?.total ?? rows.length;
    offset += batch.length;
    if (batch.length === 0 || offset >= total) break;
  }
  return rows;
}

function numOr(...vals: Array<number | null | undefined>): number | null {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

export type MultiCloseResult = {
  series: Map<string, OhlcvRow[]>;
  errors: Record<string, string>;
};

/**
 * Fetch many tickers in parallel with a concurrency cap. Per-ticker failures
 * are recorded in `errors` and skipped; fatal API errors throw.
 */
export async function loadMultipleOhlcv(
  tickers: string[],
  start: string,
  end: string,
  concurrency = 8,
): Promise<MultiCloseResult> {
  const series = new Map<string, OhlcvRow[]>();
  const errors: Record<string, string> = {};
  let idx = 0;
  let fatal = false;

  async function worker() {
    while (idx < tickers.length && !fatal) {
      const t = tickers[idx++];
      try {
        const rows = await loadOhlcv(t, start, end);
        if (rows.length === 0) errors[t] = "no data";
        else series.set(t, rows);
      } catch (err) {
        errors[t] = err instanceof Error ? err.message : "unknown";
        if (err instanceof MarketstackFatalError) {
          // Stop pulling more work, but keep whatever rows other workers
          // have already fetched. Throwing here would reject Promise.all
          // and erase the entire partial result.
          fatal = true;
        }
      }
    }
  }

  const n = Math.max(1, Math.min(concurrency, tickers.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return { series, errors };
}

/** Compute the default `start` window for a daily lookback span. */
export function startDateDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86400_000);
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
