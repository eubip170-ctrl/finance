import { NextResponse } from "next/server";
import {
  loadMultipleOhlcv,
  startDateDaysAgo,
  todayISO,
  MarketstackFatalError,
  type OhlcvRow,
} from "@/lib/markets/marketstack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  tickers?: unknown;
  lookback_days?: unknown;
};

function sanitizeTickers(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    if (typeof r !== "string") continue;
    const t = r.trim().toUpperCase();
    if (!t || seen.has(t)) continue;
    if (!/^[A-Z0-9._-]{1,16}$/.test(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const tickers = sanitizeTickers(body.tickers);
  if (tickers.length === 0) {
    return NextResponse.json({ ohlcv: {}, errors: {} });
  }

  const lookbackRaw = Number(body.lookback_days);
  const lookback = Number.isFinite(lookbackRaw)
    ? Math.max(30, Math.min(3650, Math.round(lookbackRaw)))
    : 730;

  try {
    const { series, errors } = await loadMultipleOhlcv(
      tickers,
      startDateDaysAgo(lookback),
      todayISO(),
      8,
    );
    const ohlcv: Record<string, OhlcvRow[]> = {};
    for (const t of tickers) {
      const rows = series.get(t);
      if (rows) ohlcv[t] = rows;
    }
    return NextResponse.json({ ohlcv, errors });
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
