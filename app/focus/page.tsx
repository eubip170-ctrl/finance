import Link from "next/link";
import { getManySeries, pctChangeBack, type Series } from "@/lib/markets/series";
import { FocusEventsList, type EventCardData } from "./events-list";

export const dynamic = "force-dynamic";
export const revalidate = 1800;

type Category = "Macro" | "Geopolitics" | "Risk" | "Thematic";

type FocusEvent = {
  id: string;
  name: string;
  category: Category;
  importance: 1 | 2 | 3;
  description: string;
  direction: "abs" | "risk-off";
  proxies: string[];
  countries: string[];
  indices: string[];
  sectors: string[];
};

const EVENTS: FocusEvent[] = [
  {
    id: "fed-pivot",
    name: "Fed Easing Path",
    category: "Macro",
    importance: 3,
    description:
      "Markets pricing the trajectory of US policy rates: short-end yields, gold and rate-sensitive equities react together.",
    direction: "abs",
    proxies: ["TLT", "GLD", "BIL"],
    countries: ["United States"],
    indices: ["SPY", "QQQ"],
    sectors: ["Real Estate (XLRE)", "Utilities (XLU)", "Financials (XLF)"],
  },
  {
    id: "usd-strength",
    name: "USD Strength Regime",
    category: "Macro",
    importance: 3,
    description:
      "Dollar Index dynamics squeezing EM, commodities and exporters. DXY breakouts pressure global liquidity.",
    direction: "abs",
    proxies: ["UUP", "FXE", "FXY"],
    countries: ["United States", "Eurozone", "Japan"],
    indices: ["SPY", "FEZ", "EWJ"],
    sectors: ["Materials (XLB)", "Energy (XLE)"],
  },
  {
    id: "inflation-stickiness",
    name: "Inflation Stickiness",
    category: "Macro",
    importance: 2,
    description:
      "Persistent core CPI vs. headline disinflation. Watching commodity baskets and inflation-linked bonds.",
    direction: "abs",
    proxies: ["TIP", "DBC", "USO"],
    countries: ["United States", "Eurozone", "United Kingdom"],
    indices: ["SPY", "EWU"],
    sectors: ["Energy (XLE)", "Cons. Staples (XLP)"],
  },
  {
    id: "recession-us",
    name: "US Recession Watch",
    category: "Risk",
    importance: 3,
    description:
      "Yield curve, cyclical vs. defensive equity ratio and high-yield spreads. Captures growth slowdown odds.",
    direction: "risk-off",
    proxies: ["HYG", "XLY", "XLP"],
    countries: ["United States"],
    indices: ["SPY", "IWM"],
    sectors: ["Cons. Discretionary (XLY)", "Industrials (XLI)"],
  },
  {
    id: "eu-slowdown",
    name: "Eurozone Slowdown",
    category: "Macro",
    importance: 2,
    description:
      "Bund yields, German auto and industrial exposure, EUR-denominated indices.",
    direction: "risk-off",
    proxies: ["FEZ", "EWG", "FXE"],
    countries: ["Germany", "France", "Italy"],
    indices: ["FEZ", "EWG", "EWQ"],
    sectors: ["Industrials (XLI)", "Automakers"],
  },
  {
    id: "china-reopen",
    name: "China Reopening Stalls",
    category: "Geopolitics",
    importance: 2,
    description:
      "MSCI China, copper and Hang Seng as proxies for China cyclical demand and policy support.",
    direction: "risk-off",
    proxies: ["FXI", "CPER", "EWH"],
    countries: ["China", "Hong Kong"],
    indices: ["MCHI", "FXI"],
    sectors: ["Materials (XLB)", "Industrials (XLI)"],
  },
  {
    id: "middle-east",
    name: "Middle East Tensions",
    category: "Geopolitics",
    importance: 3,
    description:
      "Oil shock and safe-haven bid: WTI/Brent, gold, defensive equity baskets.",
    direction: "abs",
    proxies: ["USO", "BNO", "GLD"],
    countries: ["Israel", "Iran", "Saudi Arabia"],
    indices: ["SPY", "KSA"],
    sectors: ["Energy (XLE)", "Defense (ITA)"],
  },
  {
    id: "sovereign-debt",
    name: "Sovereign Debt Risk",
    category: "Risk",
    importance: 2,
    description:
      "Long-end yields, US fiscal stress and EU peripheral spreads. Watching TLT vs. BNDX.",
    direction: "risk-off",
    proxies: ["TLT", "IEF", "BNDX"],
    countries: ["United States", "Italy", "Japan"],
    indices: ["SPY", "FEZ"],
    sectors: ["Financials (XLF)"],
  },
  {
    id: "ai-capex",
    name: "AI Capex Cycle",
    category: "Thematic",
    importance: 3,
    description:
      "Semis, hyperscaler capex, power infrastructure. Driving large-cap tech leadership and grid plays.",
    direction: "abs",
    proxies: ["SMH", "QQQ", "XLU"],
    countries: ["United States", "Taiwan", "South Korea"],
    indices: ["QQQ", "SMH"],
    sectors: ["Technology (XLK)", "Utilities (XLU)"],
  },
  {
    id: "energy-squeeze",
    name: "Energy Squeeze",
    category: "Risk",
    importance: 2,
    description:
      "European natural gas, US WTI and energy equity leadership rotation.",
    direction: "abs",
    proxies: ["XLE", "USO", "UNG"],
    countries: ["United States", "Eurozone", "Russia"],
    indices: ["SPY", "FEZ"],
    sectors: ["Energy (XLE)", "Utilities (XLU)"],
  },
  {
    id: "em-stress",
    name: "EM Financial Stress",
    category: "Risk",
    importance: 2,
    description:
      "EM equity, currencies and dollar-denominated EM debt. Sensitive to USD and US real rates.",
    direction: "risk-off",
    proxies: ["EEM", "EMB", "FXI"],
    countries: ["China", "Brazil", "Turkey", "South Africa"],
    indices: ["EEM", "EWZ"],
    sectors: ["Financials (XLF)", "Materials (XLB)"],
  },
  {
    id: "crypto-cycle",
    name: "Crypto Risk Appetite",
    category: "Thematic",
    importance: 1,
    description:
      "BTC and crypto-adjacent equities as a barometer for global liquidity and risk appetite.",
    direction: "abs",
    proxies: ["BITO", "COIN", "MARA"],
    countries: ["United States"],
    indices: ["QQQ"],
    sectors: ["Technology (XLK)"],
  },
];

const LOOKBACK_WINDOW = 21; // trading days used to compute the proxy return
const HISTORY_DAYS = 90; // points in the aggregate pressure timeline

type Regime = "calm" | "stress" | "panic";

function scoreFromReturns(
  ev: FocusEvent,
  returns: number[],
): { score: number; momentum: 1 | 0 | -1; regime: Regime } | null {
  if (returns.length === 0) return null;
  const adjusted = returns.map((v) => (ev.direction === "risk-off" ? -v : Math.abs(v)));
  const meanAdj = adjusted.reduce((a, b) => a + b, 0) / adjusted.length;
  const score = Math.max(0, Math.min(100, Math.round((meanAdj / 12) * 100 + 35)));

  const meanRaw = returns.reduce((a, b) => a + b, 0) / returns.length;
  const momentum: 1 | 0 | -1 = meanRaw === 0 ? 0 : meanRaw > 0 ? 1 : -1;

  const dispersion = Math.sqrt(
    returns.reduce((acc, v) => acc + (v - meanRaw) ** 2, 0) / returns.length,
  );
  const regime: Regime = dispersion > 12 ? "panic" : dispersion > 6 ? "stress" : "calm";

  return { score, momentum, regime };
}

function returnsAt(
  ev: FocusEvent,
  seriesMap: Map<string, Series>,
  daysBack: number,
): number[] {
  const out: number[] = [];
  for (const p of ev.proxies) {
    const s = seriesMap.get(p);
    if (!s) continue;
    const n = s.closes.length;
    const idx = n - 1 - daysBack;
    const prevIdx = idx - LOOKBACK_WINDOW;
    if (idx < 0 || prevIdx < 0) continue;
    const last = s.closes[idx];
    const prev = s.closes[prevIdx];
    if (!prev || prev === 0 || !Number.isFinite(prev)) continue;
    out.push(((last - prev) / prev) * 100);
  }
  return out;
}

function aggregateAt(
  events: FocusEvent[],
  seriesMap: Map<string, Series>,
  daysBack: number,
): number | null {
  let weighted = 0;
  let weights = 0;
  for (const ev of events) {
    const rets = returnsAt(ev, seriesMap, daysBack);
    const scored = scoreFromReturns(ev, rets);
    if (!scored) continue;
    weighted += scored.score * ev.importance;
    weights += ev.importance;
  }
  return weights === 0 ? null : weighted / weights;
}

function pressureRegime(p: number): Regime {
  if (p >= 65) return "panic";
  if (p >= 45) return "stress";
  return "calm";
}

export default async function FocusPage() {
  const allProxies = Array.from(new Set(EVENTS.flatMap((e) => e.proxies)));
  // We need at least HISTORY_DAYS + LOOKBACK_WINDOW + a small buffer of EOD
  // rows to compute the full 90d timeline.
  const series = await getManySeries(allProxies, 200);
  const seriesMap = new Map(series.map((s) => [s.symbol, s]));

  const scored: EventCardData[] = EVENTS.map((ev) => {
    const rets = returnsAt(ev, seriesMap, 0);
    const s = scoreFromReturns(ev, rets);

    // Sparkline: per-event score over the last 60 days, light-weight.
    const spark: number[] = [];
    for (let t = 59; t >= 0; t--) {
      const r = returnsAt(ev, seriesMap, t);
      const sc = scoreFromReturns(ev, r);
      if (sc) spark.push(sc.score);
    }

    return {
      id: ev.id,
      name: ev.name,
      category: ev.category,
      importance: ev.importance,
      description: ev.description,
      direction: ev.direction,
      proxies: ev.proxies,
      score: s?.score ?? 0,
      momentum: s?.momentum ?? 0,
      regime: s?.regime ?? "calm",
      proxyReturns: ev.proxies.map((p) => {
        const sr = seriesMap.get(p);
        return { symbol: p, ret1M: sr ? pctChangeBack(sr, LOOKBACK_WINDOW) : null };
      }),
      spark,
    };
  }).sort((a, b) => b.score - a.score);

  // Aggregate pressure now + timeline.
  const pressureNow = aggregateAt(EVENTS, seriesMap, 0) ?? 0;
  const pressure90d = aggregateAt(EVENTS, seriesMap, HISTORY_DAYS);
  const pressureDelta = pressure90d == null ? 0 : pressureNow - pressure90d;

  const timeline: Array<number | null> = [];
  for (let t = HISTORY_DAYS - 1; t >= 0; t--) {
    timeline.push(aggregateAt(EVENTS, seriesMap, t));
  }
  const validTimeline = timeline.filter((v): v is number => v != null);
  const haveTimeline = validTimeline.length >= 10;

  const buckets: Record<Regime, number> = { calm: 0, stress: 0, panic: 0 };
  scored.forEach((s) => (buckets[s.regime] += 1));

  const total = scored.length;
  const regime = pressureRegime(pressureNow);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Home
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">Focus</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">
        Live macro and geopolitical themes scored by realised proxy performance.
        Pick an event below to drill into the exposed indices and sectors with
        live returns.
      </p>

      {/* Aggregate pressure + timeline */}
      <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <AggregatePressureCard
          value={pressureNow}
          delta={pressureDelta}
          regime={regime}
        />
        <PressureTimelineCard timeline={timeline} have={haveTimeline} />
      </section>

      {/* Regime buckets */}
      <section className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <BucketCard label="Calm" tone="calm" count={buckets.calm} total={total} />
        <BucketCard label="Stress" tone="stress" count={buckets.stress} total={total} />
        <BucketCard label="Panic" tone="panic" count={buckets.panic} total={total} />
      </section>

      <FocusEventsList events={scored} />
    </main>
  );
}

const REGIME_TEXT: Record<Regime, string> = {
  calm: "text-sky-300",
  stress: "text-amber-300",
  panic: "text-red-400",
};
const REGIME_BAR: Record<Regime, string> = {
  calm: "bg-sky-400",
  stress: "bg-amber-400",
  panic: "bg-red-400",
};

function AggregatePressureCard({
  value,
  delta,
  regime,
}: {
  value: number;
  delta: number;
  regime: Regime;
}) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        Aggregate pressure
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-4xl tabular-nums text-accent">
          {value.toFixed(1)}
        </span>
        <span className="text-xs text-zinc-500">/ 100</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px]">
        <span
          className={`rounded border border-border bg-bg/40 px-1.5 py-0.5 uppercase tracking-wider ${REGIME_TEXT[regime]}`}
        >
          {regime}
        </span>
        <span
          className={
            delta > 0
              ? "text-red-400"
              : delta < 0
                ? "text-emerald-400"
                : "text-zinc-500"
          }
        >
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)} vs 90d ago
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-zinc-800">
        <div
          className={`h-full ${REGIME_BAR[regime]}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        Importance-weighted average of all event scores. Higher means broader
        macro / risk pressure across the universe.
      </p>
    </div>
  );
}

function PressureTimelineCard({
  timeline,
  have,
}: {
  timeline: Array<number | null>;
  have: boolean;
}) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-panel p-4 md:col-span-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        Aggregate pressure · last 90 trading days
      </div>
      <div className="mt-2 flex-1">
        {have ? (
          <TimelineSvg timeline={timeline} />
        ) : (
          <div className="flex h-full min-h-[8rem] items-center justify-center text-xs text-zinc-500">
            Not enough history to plot aggregate pressure timeline.
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineSvg({ timeline }: { timeline: Array<number | null> }) {
  const values = timeline.map((v, i) => ({ x: i, y: v }));
  const valid = values.filter((p): p is { x: number; y: number } => p.y != null);
  if (valid.length < 2) {
    return (
      <div className="flex h-full min-h-[8rem] items-center justify-center text-xs text-zinc-500">
        Not enough history to plot aggregate pressure timeline.
      </div>
    );
  }
  const W = 600;
  const H = 140;
  const xs = valid.map((p) => p.x);
  const ys = valid.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys, 0);
  const yMax = Math.max(...ys, 100);
  const sx = (x: number) =>
    xMax === xMin ? 0 : ((x - xMin) / (xMax - xMin)) * (W - 8) + 4;
  const sy = (y: number) =>
    yMax === yMin ? H / 2 : H - 4 - ((y - yMin) / (yMax - yMin)) * (H - 8);
  const d = valid
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`)
    .join(" ");
  const last = valid[valid.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" preserveAspectRatio="none">
      <path d={d} fill="none" stroke="#d4af37" strokeWidth={1.5} />
      <circle cx={sx(last.x)} cy={sy(last.y)} r={2.5} fill="#d4af37" />
    </svg>
  );
}

function BucketCard({
  label,
  tone,
  count,
  total,
}: {
  label: string;
  tone: Regime;
  count: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] uppercase tracking-wider ${REGIME_TEXT[tone]}`}
        >
          {label}
        </span>
        <span className="font-mono text-2xl tabular-nums text-zinc-100">{count}</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded bg-zinc-800">
        <div
          className={`h-full ${REGIME_BAR[tone]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">
        {pct}% of {total} events
      </div>
    </div>
  );
}
