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
  { id: "fed-pivot", name: "Fed Easing Path", category: "Macro", importance: 3, description: "US policy rate trajectory: short-end yields, gold and rate-sensitive equities.", direction: "abs", proxies: ["TLT", "GLD", "BIL"], countries: ["United States"], indices: ["SPY", "QQQ"], sectors: ["XLRE", "XLU", "XLF"] },
  { id: "usd-strength", name: "USD Strength Regime", category: "Macro", importance: 3, description: "Dollar Index squeezing EM, commodities, exporters.", direction: "abs", proxies: ["UUP", "FXE", "FXY"], countries: ["US", "EZ", "JP"], indices: ["SPY", "FEZ", "EWJ"], sectors: ["XLB", "XLE"] },
  { id: "inflation-stickiness", name: "Inflation Stickiness", category: "Macro", importance: 2, description: "Persistent core CPI vs. headline disinflation.", direction: "abs", proxies: ["TIP", "DBC", "USO"], countries: ["US", "EZ", "UK"], indices: ["SPY", "EWU"], sectors: ["XLE", "XLP"] },
  { id: "recession-us", name: "US Recession Watch", category: "Risk", importance: 3, description: "Yield curve, cyclical vs defensive, HY spreads.", direction: "risk-off", proxies: ["HYG", "XLY", "XLP"], countries: ["US"], indices: ["SPY", "IWM"], sectors: ["XLY", "XLI"] },
  { id: "eu-slowdown", name: "Eurozone Slowdown", category: "Macro", importance: 2, description: "Bund yields, German auto/industrial exposure, EUR indices.", direction: "risk-off", proxies: ["FEZ", "EWG", "FXE"], countries: ["DE", "FR", "IT"], indices: ["FEZ", "EWG", "EWQ"], sectors: ["XLI"] },
  { id: "china-reopen", name: "China Reopening Stalls", category: "Geopolitics", importance: 2, description: "MSCI China, copper and Hang Seng as China demand proxies.", direction: "risk-off", proxies: ["FXI", "CPER", "EWH"], countries: ["CN", "HK"], indices: ["MCHI", "FXI"], sectors: ["XLB", "XLI"] },
  { id: "middle-east", name: "Middle East Tensions", category: "Geopolitics", importance: 3, description: "Oil shock and safe-haven bid.", direction: "abs", proxies: ["USO", "BNO", "GLD"], countries: ["IL", "IR", "SA"], indices: ["SPY", "KSA"], sectors: ["XLE", "ITA"] },
  { id: "sovereign-debt", name: "Sovereign Debt Risk", category: "Risk", importance: 2, description: "Long-end yields, US fiscal stress, EU peripheral spreads.", direction: "risk-off", proxies: ["TLT", "IEF", "BNDX"], countries: ["US", "IT", "JP"], indices: ["SPY", "FEZ"], sectors: ["XLF"] },
  { id: "ai-capex", name: "AI Capex Cycle", category: "Thematic", importance: 3, description: "Semis, hyperscaler capex, power infrastructure.", direction: "abs", proxies: ["SMH", "QQQ", "XLU"], countries: ["US", "TW", "KR"], indices: ["QQQ", "SMH"], sectors: ["XLK", "XLU"] },
  { id: "energy-squeeze", name: "Energy Squeeze", category: "Risk", importance: 2, description: "European nat gas, US WTI, energy equity leadership.", direction: "abs", proxies: ["XLE", "USO", "UNG"], countries: ["US", "EZ", "RU"], indices: ["SPY", "FEZ"], sectors: ["XLE", "XLU"] },
  { id: "em-stress", name: "EM Financial Stress", category: "Risk", importance: 2, description: "EM equity, FX, USD-denominated EM debt.", direction: "risk-off", proxies: ["EEM", "EMB", "FXI"], countries: ["CN", "BR", "TR", "ZA"], indices: ["EEM", "EWZ"], sectors: ["XLF", "XLB"] },
  { id: "crypto-cycle", name: "Crypto Risk Appetite", category: "Thematic", importance: 1, description: "BTC and crypto-adjacent equities as liquidity barometer.", direction: "abs", proxies: ["BITO", "COIN", "MARA"], countries: ["US"], indices: ["QQQ"], sectors: ["XLK"] },
];

const LOOKBACK_WINDOW = 21;
const HISTORY_DAYS = 90;

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
  const series = await getManySeries(allProxies, 200);
  const seriesMap = new Map(series.map((s) => [s.symbol, s]));

  const scored: EventCardData[] = EVENTS.map((ev) => {
    const rets = returnsAt(ev, seriesMap, 0);
    const s = scoreFromReturns(ev, rets);
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

  const pressureNow = aggregateAt(EVENTS, seriesMap, 0) ?? 0;
  const pressure90d = aggregateAt(EVENTS, seriesMap, HISTORY_DAYS);
  const pressureDelta = pressure90d == null ? 0 : pressureNow - pressure90d;

  const timeline: Array<number | null> = [];
  for (let t = HISTORY_DAYS - 1; t >= 0; t--) {
    timeline.push(aggregateAt(EVENTS, seriesMap, t));
  }
  const haveTimeline = timeline.filter((v): v is number => v != null).length >= 10;

  const buckets: Record<Regime, number> = { calm: 0, stress: 0, panic: 0 };
  scored.forEach((s) => (buckets[s.regime] += 1));

  const total = scored.length;
  const regime = pressureRegime(pressureNow);

  return (
    <main className="px-3 py-3">
      <PageHeader code="FOCUS" title="MACRO FOCUS" />

      <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-4">
        <Panel code="P0" title="PRESSURE">
          <PressureBody value={pressureNow} delta={pressureDelta} regime={regime} />
        </Panel>
        <div className="xl:col-span-3">
          <Panel code="T1" title="PRESSURE · 90D TIMELINE">
            {haveTimeline ? (
              <TimelineSvg timeline={timeline} />
            ) : (
              <div className="flex h-32 items-center justify-center text-2xs uppercase text-zinc-600">
                NOT ENOUGH HISTORY
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <Bucket label="CALM" tone="calm" count={buckets.calm} total={total} />
        <Bucket label="STRESS" tone="stress" count={buckets.stress} total={total} />
        <Bucket label="PANIC" tone="panic" count={buckets.panic} total={total} />
      </div>

      <FocusEventsList events={scored} />
    </main>
  );
}

function PageHeader({ code, title }: { code: string; title: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border pb-1">
      <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
        {code}
      </span>
      <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">
        {title}
      </h1>
    </div>
  );
}

function Panel({
  code,
  title,
  children,
}: {
  code: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-panel">
      <div className="flex items-center gap-2 border-b border-border bg-black/40 px-2 py-1">
        <span className="text-2xs font-bold uppercase tracking-widest text-accent">{code}</span>
        <span className="text-2xs font-medium uppercase tracking-widest text-zinc-300">{title}</span>
      </div>
      <div className="px-2 py-2">{children}</div>
    </div>
  );
}

const REGIME_TEXT: Record<Regime, string> = {
  calm: "text-sky-300",
  stress: "text-amber-300",
  panic: "text-neg",
};
const REGIME_BAR: Record<Regime, string> = {
  calm: "bg-sky-400",
  stress: "bg-amber-400",
  panic: "bg-neg",
};

function PressureBody({
  value,
  delta,
  regime,
}: {
  value: number;
  delta: number;
  regime: Regime;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-3xl tabular-nums text-accent">{value.toFixed(1)}</span>
        <span className="text-2xs uppercase text-zinc-500">/ 100</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-2xs uppercase tracking-widest">
        <span className={`${REGIME_TEXT[regime]}`}>{regime}</span>
        <span
          className={
            delta > 0
              ? "text-neg"
              : delta < 0
                ? "text-pos"
                : "text-zinc-500"
          }
        >
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)} Δ 90D
        </span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden bg-black">
        <div
          className={`h-full ${REGIME_BAR[regime]}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

function TimelineSvg({ timeline }: { timeline: Array<number | null> }) {
  const values = timeline.map((v, i) => ({ x: i, y: v }));
  const valid = values.filter((p): p is { x: number; y: number } => p.y != null);
  if (valid.length < 2) {
    return (
      <div className="flex h-32 items-center justify-center text-2xs uppercase text-zinc-600">
        NOT ENOUGH HISTORY
      </div>
    );
  }
  const W = 600;
  const H = 120;
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
      <line x1={0} x2={W} y1={sy(yMin)} y2={sy(yMin)} stroke="#262629" />
      <line x1={0} x2={W} y1={sy((yMin + yMax) / 2)} y2={sy((yMin + yMax) / 2)} stroke="#262629" strokeDasharray="2,3" />
      <line x1={0} x2={W} y1={sy(yMax)} y2={sy(yMax)} stroke="#262629" />
      <path d={d} fill="none" stroke="#f5a623" strokeWidth={1.5} />
      <circle cx={sx(last.x)} cy={sy(last.y)} r={2.5} fill="#f5a623" />
    </svg>
  );
}

function Bucket({
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
    <div className="border border-border bg-panel px-2 py-1">
      <div className="flex items-center justify-between">
        <span className={`text-2xs font-bold uppercase tracking-widest ${REGIME_TEXT[tone]}`}>
          {label}
        </span>
        <span className="font-mono text-lg tabular-nums text-zinc-100">{count}</span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden bg-black">
        <div className={`h-full ${REGIME_BAR[tone]}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-2xs uppercase tracking-widest text-zinc-500">
        {pct}% of {total}
      </div>
    </div>
  );
}
