import { NextResponse } from "next/server";
import {
  loadOhlcv,
  startDateDaysAgo,
  todayISO,
  MarketstackFatalError,
} from "@/lib/markets/marketstack";
import { dashboardUniverseTickers } from "@/lib/dashboard/universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface ProbeRow {
  ticker: string;
  ok: boolean;
  rows: number;
  lastDate: string | null;
  error: string | null;
  ms: number;
}

async function probeOne(ticker: string): Promise<ProbeRow> {
  const t0 = Date.now();
  try {
    const rows = await loadOhlcv(ticker, startDateDaysAgo(10), todayISO());
    return {
      ticker,
      ok: rows.length > 0,
      rows: rows.length,
      lastDate: rows.length > 0 ? rows[rows.length - 1].date : null,
      error: rows.length === 0 ? "no rows" : null,
      ms: Date.now() - t0,
    };
  } catch (err) {
    if (err instanceof MarketstackFatalError) throw err;
    return {
      ticker,
      ok: false,
      rows: 0,
      lastDate: null,
      error: err instanceof Error ? err.message : "unknown",
      ms: Date.now() - t0,
    };
  }
}

async function probeMany(
  tickers: string[],
  concurrency: number,
): Promise<ProbeRow[]> {
  const out: ProbeRow[] = [];
  let idx = 0;
  async function worker() {
    while (idx < tickers.length) {
      const t = tickers[idx++];
      out.push(await probeOne(t));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tickers.length) }, () => worker()));
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 120) || 120, 200);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  const concurrency = Math.min(
    Math.max(1, Number(url.searchParams.get("concurrency") ?? 6) || 6),
    12,
  );
  const onlyParam = url.searchParams.get("only");

  if (!process.env.MARKETSTACK_API_KEY) {
    return NextResponse.json(
      { error: "MARKETSTACK_API_KEY not set" },
      { status: 503 },
    );
  }

  const universe = onlyParam
    ? onlyParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : dashboardUniverseTickers();

  const slice = universe.slice(offset, offset + limit);
  const t0 = Date.now();
  try {
    const results = await probeMany(slice, concurrency);
    results.sort((a, b) => Number(b.ok) - Number(a.ok) || a.ticker.localeCompare(b.ticker));

    const okCount = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    const errorCounts: Record<string, number> = {};
    for (const r of failed) {
      const key = (r.error ?? "unknown").slice(0, 80);
      errorCounts[key] = (errorCounts[key] ?? 0) + 1;
    }
    const topErrors = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([message, count]) => ({ message, count }));

    return NextResponse.json({
      ok: okCount > 0,
      total: slice.length,
      offset,
      limit,
      okCount,
      failedCount: failed.length,
      results,
      topErrors,
      durationMs: Date.now() - t0,
      universeSize: universe.length,
      nextOffset: offset + slice.length < universe.length ? offset + slice.length : null,
    });
  } catch (err) {
    if (err instanceof MarketstackFatalError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
