import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { loadOhlcv, todayISO, startDateDaysAgo, MarketstackFatalError } from "@/lib/markets/marketstack";
import { readCache } from "@/lib/cache/market-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Check = { ok: boolean; detail?: string; ms?: number };

async function checkEnv(): Promise<Record<string, Check>> {
  const requireSet = (k: string): Check => ({
    ok: Boolean(process.env[k]),
    detail: process.env[k] ? "set" : "missing",
  });
  return {
    NEXT_PUBLIC_SUPABASE_URL: requireSet("NEXT_PUBLIC_SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: requireSet("SUPABASE_SERVICE_ROLE_KEY"),
    MARKETSTACK_API_KEY: requireSet("MARKETSTACK_API_KEY"),
    OPENAI_API_KEY: requireSet("OPENAI_API_KEY"),
    CRON_SECRET: requireSet("CRON_SECRET"),
  };
}

async function checkSupabase(): Promise<Check> {
  const t0 = Date.now();
  try {
    const supabase = supabaseAdmin();
    const { error } = await supabase.from("market_cache").select("key").limit(1);
    if (error) return { ok: false, detail: error.message, ms: Date.now() - t0 };
    return { ok: true, detail: "market_cache table reachable", ms: Date.now() - t0 };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "unknown",
      ms: Date.now() - t0,
    };
  }
}

async function checkMarketstack(): Promise<Check> {
  const t0 = Date.now();
  if (!process.env.MARKETSTACK_API_KEY) {
    return { ok: false, detail: "MARKETSTACK_API_KEY not set" };
  }
  try {
    const rows = await loadOhlcv("SPY", startDateDaysAgo(10), todayISO());
    return {
      ok: rows.length > 0,
      detail: rows.length > 0
        ? `SPY OK — ${rows.length} rows, last ${rows[rows.length - 1].date}`
        : "SPY returned 0 rows (quota or plan?)",
      ms: Date.now() - t0,
    };
  } catch (err) {
    if (err instanceof MarketstackFatalError) {
      return { ok: false, detail: err.message, ms: Date.now() - t0 };
    }
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "unknown",
      ms: Date.now() - t0,
    };
  }
}

async function checkCache(): Promise<Record<string, Check>> {
  const keys = ["dashboard", "focus"];
  const out: Record<string, Check> = {};
  for (const k of keys) {
    const t0 = Date.now();
    try {
      const row = await readCache(k);
      if (!row) {
        out[k] = { ok: false, detail: "no row (cron never ran)", ms: Date.now() - t0 };
      } else {
        const ageH = Math.round(row.ageSec / 360) / 10;
        out[k] = {
          ok: !row.stale,
          detail: `${row.stale ? "stale" : "fresh"} · age ${ageH}h · updated ${row.updatedAt}`,
          ms: Date.now() - t0,
        };
      }
    } catch (err) {
      out[k] = {
        ok: false,
        detail: err instanceof Error ? err.message : "unknown",
        ms: Date.now() - t0,
      };
    }
  }
  return out;
}

export async function GET() {
  const env = await checkEnv();
  const [supabase, marketstack, cache] = await Promise.all([
    checkSupabase(),
    checkMarketstack(),
    checkCache(),
  ]);

  const allOk =
    Object.values(env).every((c) => c.ok) &&
    supabase.ok &&
    marketstack.ok &&
    Object.values(cache).every((c) => c.ok);

  return NextResponse.json(
    {
      ok: allOk,
      env,
      supabase,
      marketstack,
      cache,
      ts: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 },
  );
}
