import { getManySeries } from "@/lib/markets/series";
import {
  DASHBOARD_GROUPS,
  DASHBOARD_PULSE,
  dashboardUniverseTickers,
} from "@/lib/dashboard/universe";

export type DashboardPeriod =
  | "1D"
  | "5D"
  | "1M"
  | "3M"
  | "6M"
  | "YTD"
  | "1Y"
  | "3Y"
  | "5Y";

const PERIOD_KEYS: DashboardPeriod[] = [
  "1D",
  "5D",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
  "3Y",
  "5Y",
];

const PERIOD_BARS: Record<DashboardPeriod, number> = {
  "1D": 1,
  "5D": 5,
  "1M": 21,
  "3M": 63,
  "6M": 126,
  YTD: 0,
  "1Y": 252,
  "3Y": 756,
  "5Y": 1260,
};

/**
 * How many trailing bars to keep in the payload. Enough to cover up to a 1Y
 * relative-perf tracker plus a small buffer. 3Y/5Y returns are still computed
 * by the server when possible — they just won't have a full tracker line.
 *
 * Reducing this from 800 → 320 cuts the cached payload size from ~5 MB to
 * ~1.5 MB and slashes initial render time accordingly.
 */
const SLIM_BARS = 320;

/**
 * Long-form server fetch — must still pull a deep history so the `returns`
 * computation can resolve 3Y / 5Y windows. The actual close arrays handed to
 * the client are sliced to SLIM_BARS just below.
 */
const LOOKBACK_DAYS_DEEP = 1600;

export interface DashboardPayload {
  groups: Array<{
    key: string;
    label: string;
    benchmark: string;
    tickers: Array<{ t: string; n: string }>;
  }>;
  pulse: string[];
  series: Record<string, { dates: number[]; closes: number[] }>;
  /**
   * Pre-computed pct returns per ticker for every dashboard period. The client
   * uses these directly instead of running periodReturn() on every render —
   * saves ~80 × 9 = 720 array scans on every period click.
   */
  returns: Record<string, Partial<Record<DashboardPeriod, number | null>>>;
  errors: string[];
}

function pctBars(closes: number[], nBack: number): number | null {
  const n = closes.length;
  if (n < 2 || nBack < 1 || n - 1 - nBack < 0) return null;
  const last = closes[n - 1];
  const prev = closes[n - 1 - nBack];
  if (!prev || prev === 0) return null;
  return ((last - prev) / prev) * 100;
}

function pctYTD(dates: number[], closes: number[]): number | null {
  if (closes.length < 2) return null;
  const year = new Date().getUTCFullYear();
  for (let i = 0; i < dates.length; i++) {
    const d = new Date(dates[i] * 1000);
    if (d.getUTCFullYear() === year) {
      const anchor = closes[i];
      if (!anchor) return null;
      const last = closes[closes.length - 1];
      return ((last - anchor) / anchor) * 100;
    }
  }
  return null;
}

function periodReturn(
  dates: number[],
  closes: number[],
  p: DashboardPeriod,
): number | null {
  if (p === "YTD") return pctYTD(dates, closes);
  return pctBars(closes, PERIOD_BARS[p]);
}

/**
 * Single source of truth for the dashboard payload. Used by:
 *   - app/dashboard/page.tsx (cache-first server fetch)
 *   - app/api/cron/refresh-market (the cron writes this to market_cache)
 */
export async function computeDashboardPayload(): Promise<DashboardPayload> {
  const tickers = dashboardUniverseTickers();
  const series = await getManySeries(tickers, LOOKBACK_DAYS_DEEP);

  const errors: string[] = [];
  const seriesMap: Record<string, { dates: number[]; closes: number[] }> = {};
  const returns: DashboardPayload["returns"] = {};

  for (const s of series) {
    // Compute returns on the FULL series first — needed for 3Y/5Y windows.
    const rec: Partial<Record<DashboardPeriod, number | null>> = {};
    for (const p of PERIOD_KEYS) {
      rec[p] = periodReturn(s.timestamps, s.closes, p);
    }
    returns[s.symbol] = rec;

    // Slim the close array sent to the client so the JSON stays small. We
    // keep enough trailing history for the 1Y tracker plus a safety buffer.
    const start = Math.max(0, s.closes.length - SLIM_BARS);
    seriesMap[s.symbol] = {
      dates: s.timestamps.slice(start),
      closes: s.closes.slice(start),
    };
  }
  for (const t of tickers) {
    if (!seriesMap[t]) errors.push(t);
  }

  return {
    groups: DASHBOARD_GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      benchmark: g.benchmark,
      tickers: g.tickers,
    })),
    pulse: DASHBOARD_PULSE,
    series: seriesMap,
    returns,
    errors,
  };
}
