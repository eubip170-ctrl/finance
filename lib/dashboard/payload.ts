import { getManySeries } from "@/lib/markets/series";
import {
  DASHBOARD_GROUPS,
  DASHBOARD_PULSE,
  dashboardUniverseTickers,
} from "@/lib/dashboard/universe";

export interface DashboardPayload {
  groups: Array<{
    key: string;
    label: string;
    benchmark: string;
    tickers: Array<{ t: string; n: string }>;
  }>;
  pulse: string[];
  series: Record<string, { dates: number[]; closes: number[] }>;
  errors: string[];
}

/**
 * Single source of truth for the dashboard payload. Used by:
 *   - app/dashboard/page.tsx (cache-first server fetch)
 *   - app/api/cron/refresh-market (the cron writes this to market_cache)
 */
export async function computeDashboardPayload(
  lookbackDays = 800,
): Promise<DashboardPayload> {
  const tickers = dashboardUniverseTickers();
  const series = await getManySeries(tickers, lookbackDays);

  const errors: string[] = [];
  const seriesMap: Record<string, { dates: number[]; closes: number[] }> = {};
  for (const s of series) seriesMap[s.symbol] = { dates: s.timestamps, closes: s.closes };
  for (const t of tickers) if (!seriesMap[t]) errors.push(t);

  return {
    groups: DASHBOARD_GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      benchmark: g.benchmark,
      tickers: g.tickers,
    })),
    pulse: DASHBOARD_PULSE,
    series: seriesMap,
    errors,
  };
}
