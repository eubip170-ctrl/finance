import { getManySeries, pctChangeBack, type Series } from "@/lib/markets/series";
import { FOCUS_EVENTS, focusUniverseTickers, type FocusEventDef } from "@/lib/focus/universe";

export type Regime = "calm" | "stress" | "panic";

export interface FocusEventCard {
  id: string;
  name: string;
  category: FocusEventDef["category"];
  importance: 1 | 2 | 3;
  description: string;
  direction: "abs" | "risk-off";
  proxies: string[];
  score: number;
  momentum: 1 | 0 | -1;
  regime: Regime;
  proxyReturns: Array<{ symbol: string; ret1M: number | null }>;
  spark: number[];
}

export interface FocusPayload {
  events: FocusEventCard[];
  pressureNow: number;
  pressureDelta: number;
  timeline: Array<number | null>;
  buckets: Record<Regime, number>;
  regime: Regime;
  total: number;
  generatedAt: string;
}

const LOOKBACK_WINDOW = 21;
const HISTORY_DAYS = 90;

function scoreFromReturns(
  ev: FocusEventDef,
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
  ev: FocusEventDef,
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
  events: FocusEventDef[],
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

export async function computeFocusPayload(): Promise<FocusPayload> {
  const proxies = focusUniverseTickers();
  const series = await getManySeries(proxies, 200);
  const seriesMap = new Map(series.map((s) => [s.symbol, s]));

  const events: FocusEventCard[] = FOCUS_EVENTS.map((ev) => {
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

  const pressureNow = aggregateAt(FOCUS_EVENTS, seriesMap, 0) ?? 0;
  const pressure90d = aggregateAt(FOCUS_EVENTS, seriesMap, HISTORY_DAYS);
  const pressureDelta = pressure90d == null ? 0 : pressureNow - pressure90d;

  const timeline: Array<number | null> = [];
  for (let t = HISTORY_DAYS - 1; t >= 0; t--) {
    timeline.push(aggregateAt(FOCUS_EVENTS, seriesMap, t));
  }

  const buckets: Record<Regime, number> = { calm: 0, stress: 0, panic: 0 };
  events.forEach((e) => (buckets[e.regime] += 1));

  return {
    events,
    pressureNow,
    pressureDelta,
    timeline,
    buckets,
    regime: pressureRegime(pressureNow),
    total: events.length,
    generatedAt: new Date().toISOString(),
  };
}
