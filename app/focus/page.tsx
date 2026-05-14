import Link from "next/link";
import { getManySeries, pctChangeBack, type Series } from "@/lib/markets/series";

export const dynamic = "force-dynamic";
export const revalidate = 1800;

type Category = "Macro" | "Geopolitics" | "Risk" | "Thematic";

type FocusEvent = {
  id: string;
  name: string;
  category: Category;
  importance: 1 | 2 | 3; // 3 = highest
  description: string;
  /** Direction: 'abs' = absolute magnitude matters; 'risk-off' = proxy down = stress */
  direction: "abs" | "risk-off";
  /** Tickers used to estimate stress level (Yahoo symbols) */
  proxies: string[];
  countries: string[];
  indices: string[];
  sectors: string[];
};

/**
 * Curated set of live macro / geopolitical themes inspired by the medge Focus
 * engine. The "score" is calculated from realised performance of the proxy
 * tickers over the last 20 trading days, projected to 0-100. The regime is
 * derived from VIX-equivalent realised volatility on the same window.
 */
const EVENTS: FocusEvent[] = [
  {
    id: "fed-pivot",
    name: "Fed Easing Path",
    category: "Macro",
    importance: 3,
    description:
      "Markets pricing the trajectory of US policy rates: short-end yields, gold and rate-sensitive equities react together.",
    direction: "abs",
    proxies: ["TLT", "GC=F", "^IRX"],
    countries: ["United States"],
    indices: ["^GSPC", "^IXIC"],
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
    proxies: ["DX-Y.NYB", "EURUSD=X", "USDJPY=X"],
    countries: ["United States", "Eurozone", "Japan"],
    indices: ["^GSPC", "^STOXX50E", "^N225"],
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
    proxies: ["TIP", "DBC", "CL=F"],
    countries: ["United States", "Eurozone", "United Kingdom"],
    indices: ["^GSPC", "^FTSE"],
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
    indices: ["^GSPC", "^RUT"],
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
    proxies: ["^STOXX50E", "EWG", "EURUSD=X"],
    countries: ["Germany", "France", "Italy"],
    indices: ["^STOXX50E", "^GDAXI", "^FCHI"],
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
    proxies: ["FXI", "HG=F", "^HSI"],
    countries: ["China", "Hong Kong"],
    indices: ["^HSI", "000001.SS"],
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
    proxies: ["CL=F", "BZ=F", "GC=F"],
    countries: ["Israel", "Iran", "Saudi Arabia"],
    indices: ["^GSPC", "^TASI"],
    sectors: ["Energy (XLE)", "Defense"],
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
    indices: ["^GSPC", "^STOXX50E"],
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
    indices: ["^IXIC", "^NDX"],
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
    proxies: ["XLE", "CL=F", "UNG"],
    countries: ["United States", "Eurozone", "Russia"],
    indices: ["^GSPC", "^STOXX50E"],
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
    indices: ["EEM", "^BVSP"],
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
    proxies: ["BTC-USD", "ETH-USD", "COIN"],
    countries: ["United States"],
    indices: ["^IXIC"],
    sectors: ["Technology (XLK)"],
  },
];

type Scored = FocusEvent & {
  score: number; // 0-100
  momentum: number; // -1..+1 (sign of net 1M proxy move)
  regime: "calm" | "stress" | "panic";
  proxyReturns: Array<{ symbol: string; ret1M: number | null }>;
};

function scoreEvent(ev: FocusEvent, seriesMap: Map<string, Series>): Scored {
  const proxyReturns = ev.proxies.map((p) => {
    const s = seriesMap.get(p);
    return { symbol: p, ret1M: s ? pctChangeBack(s, 21) : null };
  });
  const valid = proxyReturns.map((r) => r.ret1M).filter((v): v is number => v != null);
  if (valid.length === 0) {
    return { ...ev, score: 0, momentum: 0, regime: "calm", proxyReturns };
  }

  // For 'abs' direction, raw magnitude drives score; for 'risk-off' a negative
  // proxy move increases stress (we flip the sign).
  const adjusted = valid.map((v) => (ev.direction === "risk-off" ? -v : Math.abs(v)));
  const meanAdj = adjusted.reduce((a, b) => a + b, 0) / adjusted.length;
  // Map a mean adjusted return of ~12% (1M) onto a 100 score, clipped.
  const score = Math.max(0, Math.min(100, Math.round((meanAdj / 12) * 100 + 35)));

  const meanRaw = valid.reduce((a, b) => a + b, 0) / valid.length;
  const momentum = meanRaw === 0 ? 0 : meanRaw > 0 ? 1 : -1;

  // Regime tiers based on realised dispersion of proxy moves.
  const dispersion = Math.sqrt(
    valid.reduce((acc, v) => acc + (v - meanRaw) ** 2, 0) / valid.length,
  );
  const regime: Scored["regime"] =
    dispersion > 12 ? "panic" : dispersion > 6 ? "stress" : "calm";

  return { ...ev, score, momentum, regime, proxyReturns };
}

const CATEGORY_TONE: Record<Category, string> = {
  Macro: "text-sky-300 border-sky-900/60 bg-sky-950/40",
  Geopolitics: "text-rose-300 border-rose-900/60 bg-rose-950/40",
  Risk: "text-amber-300 border-amber-900/60 bg-amber-950/40",
  Thematic: "text-violet-300 border-violet-900/60 bg-violet-950/40",
};

const REGIME_TONE: Record<Scored["regime"], string> = {
  calm: "text-sky-300",
  stress: "text-amber-300",
  panic: "text-red-400",
};

export default async function FocusPage() {
  const allProxies = Array.from(new Set(EVENTS.flatMap((e) => e.proxies)));
  const series = await getManySeries(allProxies, "3mo", "1d");
  const seriesMap = new Map(series.map((s) => [s.symbol, s]));

  const scored = EVENTS.map((e) => scoreEvent(e, seriesMap)).sort(
    (a, b) => b.score - a.score,
  );

  const byCategory: Record<Category, Scored[]> = {
    Macro: [],
    Geopolitics: [],
    Risk: [],
    Thematic: [],
  };
  scored.forEach((s) => byCategory[s.category].push(s));

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Home
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">Focus</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">
        Live macro and geopolitical themes scored by realised proxy performance.
        Each card shows score, momentum, market regime and the exposed
        countries, indices and sectors.
      </p>

      {/* Score legend */}
      <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
        <Legend label="Calm" tone="text-sky-300" />
        <Legend label="Stress" tone="text-amber-300" />
        <Legend label="Panic" tone="text-red-400" />
        <span className="ml-auto rounded border border-border bg-panel px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-400">
          {scored.length} events tracked
        </span>
      </div>

      {(["Macro", "Geopolitics", "Risk", "Thematic"] as Category[]).map((cat) => (
        <section key={cat} className="mt-10">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
              {cat}
            </h2>
            <span className="rounded border border-border bg-panel px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
              {byCategory[cat].length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {byCategory[cat].map((ev) => (
              <EventCard key={ev.id} ev={ev} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

function Legend({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${tone}`}>
      <span className="inline-block h-2 w-2 rounded-full bg-current" />
      {label}
    </span>
  );
}

function EventCard({ ev }: { ev: Scored }) {
  return (
    <article className="rounded-lg border border-border bg-panel p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                CATEGORY_TONE[ev.category]
              }`}
            >
              {ev.category}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-zinc-600">
              importance {ev.importance}/3
            </span>
          </div>
          <h3 className="mt-1 text-base font-medium text-zinc-100">{ev.name}</h3>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl tabular-nums text-accent">{ev.score}</div>
          <div className={`text-[10px] uppercase tracking-wider ${REGIME_TONE[ev.regime]}`}>
            {ev.regime}
          </div>
        </div>
      </header>

      <p className="mt-2 text-sm text-zinc-400">{ev.description}</p>

      {/* Score bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-zinc-800">
        <div
          className="h-full bg-accent"
          style={{ width: `${ev.score}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className="text-zinc-500">
          momentum:{" "}
          <span
            className={
              ev.momentum > 0
                ? "text-emerald-400"
                : ev.momentum < 0
                  ? "text-red-400"
                  : "text-zinc-400"
            }
          >
            {ev.momentum > 0 ? "▲ rising" : ev.momentum < 0 ? "▼ falling" : "flat"}
          </span>
        </span>
        <span className="text-zinc-500">
          direction:{" "}
          <span className="text-zinc-300">{ev.direction}</span>
        </span>
      </div>

      {/* Proxy returns */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        {ev.proxyReturns.map((p) => {
          const v = p.ret1M;
          const positive = v != null && v >= 0;
          return (
            <div key={p.symbol} className="rounded border border-border bg-bg/40 px-2 py-1.5">
              <div className="font-mono text-[10px] text-zinc-500">{p.symbol}</div>
              <div
                className={`font-mono tabular-nums ${
                  v == null ? "text-zinc-600" : positive ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Influences */}
      <div className="mt-3 space-y-1 text-[11px]">
        <Influence label="Countries" items={ev.countries} />
        <Influence label="Indices" items={ev.indices} />
        <Influence label="Sectors" items={ev.sectors} />
      </div>
    </article>
  );
}

function Influence({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      <span className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</span>
      {items.map((it) => (
        <span
          key={it}
          className="rounded border border-border bg-bg/40 px-1.5 py-0.5 text-[10px] text-zinc-300"
        >
          {it}
        </span>
      ))}
    </div>
  );
}
