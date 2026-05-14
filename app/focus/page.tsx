import Link from "next/link";
import { Sparkline } from "@/components/dashboard/Sparkline";
import {
  getManySeries,
  multiPeriodReturns,
  pctChangeBack,
  type Series,
} from "@/lib/markets/series";

export const dynamic = "force-dynamic";
export const revalidate = 1800;

type Category = "Macro" | "Geopolitics" | "Risk" | "Thematic";

type Influence = { label: string; ticker?: string };

type FocusEvent = {
  id: string;
  name: string;
  category: Category;
  importance: 1 | 2 | 3; // 3 = highest
  description: string;
  /** 'abs' = magnitude matters; 'risk-off' = proxy down = stress */
  direction: "abs" | "risk-off";
  /** MarketStack v2 US-listed tickers used to score stress level */
  proxies: string[];
  /** Influences ship as { label, ticker } so we can fetch live returns. */
  countries: Influence[];
  indices: Influence[];
  sectors: Influence[];
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
    countries: [{ label: "United States" }],
    indices: [
      { label: "S&P 500", ticker: "SPY" },
      { label: "Nasdaq 100", ticker: "QQQ" },
    ],
    sectors: [
      { label: "Real Estate", ticker: "XLRE" },
      { label: "Utilities", ticker: "XLU" },
      { label: "Financials", ticker: "XLF" },
    ],
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
    countries: [
      { label: "United States" },
      { label: "Eurozone" },
      { label: "Japan" },
    ],
    indices: [
      { label: "S&P 500", ticker: "SPY" },
      { label: "Euro Stoxx 50", ticker: "FEZ" },
      { label: "Japan", ticker: "EWJ" },
    ],
    sectors: [
      { label: "Materials", ticker: "XLB" },
      { label: "Energy", ticker: "XLE" },
    ],
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
    countries: [
      { label: "United States" },
      { label: "Eurozone" },
      { label: "United Kingdom" },
    ],
    indices: [
      { label: "S&P 500", ticker: "SPY" },
      { label: "United Kingdom", ticker: "EWU" },
    ],
    sectors: [
      { label: "Energy", ticker: "XLE" },
      { label: "Cons. Staples", ticker: "XLP" },
    ],
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
    countries: [{ label: "United States" }],
    indices: [
      { label: "S&P 500", ticker: "SPY" },
      { label: "Russell 2000", ticker: "IWM" },
    ],
    sectors: [
      { label: "Cons. Discretionary", ticker: "XLY" },
      { label: "Industrials", ticker: "XLI" },
    ],
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
    countries: [
      { label: "Germany" },
      { label: "France" },
      { label: "Italy" },
    ],
    indices: [
      { label: "Euro Stoxx 50", ticker: "FEZ" },
      { label: "Germany", ticker: "EWG" },
      { label: "France", ticker: "EWQ" },
    ],
    sectors: [{ label: "Industrials", ticker: "XLI" }],
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
    countries: [{ label: "China" }, { label: "Hong Kong" }],
    indices: [
      { label: "MSCI China", ticker: "MCHI" },
      { label: "China Large-Cap", ticker: "FXI" },
    ],
    sectors: [
      { label: "Materials", ticker: "XLB" },
      { label: "Industrials", ticker: "XLI" },
    ],
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
    countries: [
      { label: "Israel" },
      { label: "Iran" },
      { label: "Saudi Arabia" },
    ],
    indices: [
      { label: "S&P 500", ticker: "SPY" },
      { label: "Saudi Arabia", ticker: "KSA" },
    ],
    sectors: [
      { label: "Energy", ticker: "XLE" },
      { label: "Defense", ticker: "ITA" },
    ],
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
    countries: [
      { label: "United States" },
      { label: "Italy" },
      { label: "Japan" },
    ],
    indices: [
      { label: "S&P 500", ticker: "SPY" },
      { label: "Euro Stoxx 50", ticker: "FEZ" },
    ],
    sectors: [{ label: "Financials", ticker: "XLF" }],
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
    countries: [
      { label: "United States" },
      { label: "Taiwan" },
      { label: "South Korea" },
    ],
    indices: [
      { label: "Nasdaq 100", ticker: "QQQ" },
      { label: "Semis", ticker: "SMH" },
    ],
    sectors: [
      { label: "Technology", ticker: "XLK" },
      { label: "Utilities", ticker: "XLU" },
    ],
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
    countries: [
      { label: "United States" },
      { label: "Eurozone" },
      { label: "Russia" },
    ],
    indices: [
      { label: "S&P 500", ticker: "SPY" },
      { label: "Euro Stoxx 50", ticker: "FEZ" },
    ],
    sectors: [
      { label: "Energy", ticker: "XLE" },
      { label: "Utilities", ticker: "XLU" },
    ],
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
    countries: [
      { label: "China" },
      { label: "Brazil" },
      { label: "Turkey" },
      { label: "South Africa" },
    ],
    indices: [
      { label: "EM Equities", ticker: "EEM" },
      { label: "Brazil", ticker: "EWZ" },
    ],
    sectors: [
      { label: "Financials", ticker: "XLF" },
      { label: "Materials", ticker: "XLB" },
    ],
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
    countries: [{ label: "United States" }],
    indices: [{ label: "Nasdaq 100", ticker: "QQQ" }],
    sectors: [{ label: "Technology", ticker: "XLK" }],
  },
];

const CATEGORIES: Category[] = ["Macro", "Geopolitics", "Risk", "Thematic"];

type Scored = FocusEvent & {
  score: number; // 0-100
  momentum: number; // -1..+1 (sign of net 1M proxy move)
  regime: "calm" | "stress" | "panic";
  proxyReturns: Array<{ symbol: string; ret1M: number | null }>;
  proxySpark: number[]; // averaged normalised proxy path
};

function scoreEvent(ev: FocusEvent, seriesMap: Map<string, Series>): Scored {
  const proxyReturns = ev.proxies.map((p) => {
    const s = seriesMap.get(p);
    return { symbol: p, ret1M: s ? pctChangeBack(s, 21) : null };
  });
  const valid = proxyReturns.map((r) => r.ret1M).filter((v): v is number => v != null);

  // Build a normalised average sparkline across the proxies that have data.
  const proxySpark = averagedNormalisedPath(
    ev.proxies.map((p) => seriesMap.get(p)).filter((s): s is Series => !!s),
  );

  if (valid.length === 0) {
    return {
      ...ev,
      score: 0,
      momentum: 0,
      regime: "calm",
      proxyReturns,
      proxySpark,
    };
  }

  const adjusted = valid.map((v) => (ev.direction === "risk-off" ? -v : Math.abs(v)));
  const meanAdj = adjusted.reduce((a, b) => a + b, 0) / adjusted.length;
  const score = Math.max(0, Math.min(100, Math.round((meanAdj / 12) * 100 + 35)));

  const meanRaw = valid.reduce((a, b) => a + b, 0) / valid.length;
  const momentum = meanRaw === 0 ? 0 : meanRaw > 0 ? 1 : -1;

  const dispersion = Math.sqrt(
    valid.reduce((acc, v) => acc + (v - meanRaw) ** 2, 0) / valid.length,
  );
  const regime: Scored["regime"] =
    dispersion > 12 ? "panic" : dispersion > 6 ? "stress" : "calm";

  return { ...ev, score, momentum, regime, proxyReturns, proxySpark };
}

function averagedNormalisedPath(seriesList: Series[]): number[] {
  if (seriesList.length === 0) return [];
  // Use the trailing 60 closes of each series, normalised to start at 1.
  const N = 60;
  const trimmed = seriesList
    .map((s) => s.closes.slice(-N))
    .filter((arr) => arr.length >= 2);
  if (trimmed.length === 0) return [];
  const minLen = Math.min(...trimmed.map((a) => a.length));
  const out: number[] = [];
  for (let i = 0; i < minLen; i++) {
    let s = 0;
    let n = 0;
    for (const arr of trimmed) {
      const v = arr[arr.length - minLen + i] / arr[arr.length - minLen];
      if (Number.isFinite(v)) {
        s += v;
        n += 1;
      }
    }
    out.push(n > 0 ? s / n : 1);
  }
  return out;
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

type SP = { searchParams?: Promise<{ cat?: string; event?: string }> };

export default async function FocusPage(props: SP) {
  const sp = (await props.searchParams) ?? {};
  const catFilter = CATEGORIES.includes(sp.cat as Category)
    ? (sp.cat as Category)
    : null;
  const selectedId = sp.event ?? null;

  // Fetch proxies + every ticker referenced in indices/sectors so the detail
  // panel and the influence chips can show live returns.
  const proxyTickers = EVENTS.flatMap((e) => e.proxies);
  const influenceTickers = EVENTS.flatMap((e) => [
    ...e.indices.map((i) => i.ticker),
    ...e.sectors.map((s) => s.ticker),
  ]).filter((t): t is string => !!t);

  const allTickers = Array.from(new Set([...proxyTickers, ...influenceTickers]));
  const series = await getManySeries(allTickers, 120);
  const seriesMap = new Map(series.map((s) => [s.symbol, s]));

  const dataMissing = series.length === 0;

  const scored = EVENTS.map((e) => scoreEvent(e, seriesMap)).sort(
    (a, b) => b.score - a.score,
  );

  const filtered = catFilter
    ? scored.filter((s) => s.category === catFilter)
    : scored;

  const regimeCounts = {
    calm: scored.filter((s) => s.regime === "calm").length,
    stress: scored.filter((s) => s.regime === "stress").length,
    panic: scored.filter((s) => s.regime === "panic").length,
  };

  const selected = selectedId ? scored.find((s) => s.id === selectedId) : null;

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

      {dataMissing && (
        <div className="mt-6 rounded-md border border-amber-900 bg-amber-950/40 p-3 text-sm text-amber-300">
          No data returned from MarketStack. Verify{" "}
          <code className="text-amber-100">MARKETSTACK_API_KEY</code> on Vercel
          (Settings → Environment Variables) and that the quota has not been
          exhausted.
        </div>
      )}

      {/* Regime distribution */}
      <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <RegimeStat
          label="Calm"
          count={regimeCounts.calm}
          total={scored.length}
          tone="text-sky-300"
          bar="bg-sky-500"
        />
        <RegimeStat
          label="Stress"
          count={regimeCounts.stress}
          total={scored.length}
          tone="text-amber-300"
          bar="bg-amber-500"
        />
        <RegimeStat
          label="Panic"
          count={regimeCounts.panic}
          total={scored.length}
          tone="text-red-400"
          bar="bg-red-500"
        />
      </section>

      {/* Category filter */}
      <section className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">
          Filter
        </span>
        <FilterChip href="/focus" label={`All (${scored.length})`} active={!catFilter} />
        {CATEGORIES.map((c) => {
          const n = scored.filter((s) => s.category === c).length;
          return (
            <FilterChip
              key={c}
              href={`/focus?cat=${c}`}
              label={`${c} (${n})`}
              active={catFilter === c}
            />
          );
        })}
      </section>

      {/* Selected event detail */}
      {selected && (
        <SelectedEventPanel ev={selected} seriesMap={seriesMap} />
      )}

      {/* Event cards */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
            {catFilter ?? "All events"}
          </h2>
          <span className="rounded border border-border bg-panel px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
            {filtered.length}
          </span>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-zinc-500">No events match this filter.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filtered.map((ev) => (
              <EventCard key={ev.id} ev={ev} selected={selectedId === ev.id} catFilter={catFilter} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function RegimeStat({
  label,
  count,
  total,
  tone,
  bar,
}: {
  label: string;
  count: number;
  total: number;
  tone: string;
  bar: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <div className="flex items-baseline justify-between">
        <span className={`text-xs uppercase tracking-wide ${tone}`}>{label}</span>
        <span className="font-mono text-xl tabular-nums text-zinc-100">{count}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-zinc-800">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">
        {pct.toFixed(0)}% of {total} events
      </div>
    </div>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded border px-2 py-1 text-xs ${
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-border bg-panel text-zinc-400 hover:text-zinc-100"
      }`}
    >
      {label}
    </Link>
  );
}

function EventCard({
  ev,
  selected,
  catFilter,
}: {
  ev: Scored;
  selected: boolean;
  catFilter: Category | null;
}) {
  const detailHref = selected
    ? catFilter
      ? `/focus?cat=${catFilter}`
      : "/focus"
    : `/focus?${catFilter ? `cat=${catFilter}&` : ""}event=${ev.id}#detail`;

  return (
    <Link
      href={detailHref}
      scroll={false}
      className={`block rounded-lg border bg-panel p-4 transition ${
        selected
          ? "border-accent shadow-[0_0_0_1px_rgba(212,175,55,0.3)]"
          : "border-border hover:border-accent/40"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${CATEGORY_TONE[ev.category]}`}
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

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-zinc-800">
        <div className="h-full bg-accent" style={{ width: `${ev.score}%` }} />
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

      {/* Sparkline of averaged proxy path */}
      {ev.proxySpark.length > 1 && (
        <div className="mt-3 h-9 w-full">
          <Sparkline values={ev.proxySpark} positive={ev.momentum >= 0} height={36} />
        </div>
      )}

      {/* Proxy returns */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        {ev.proxyReturns.map((p) => {
          const v = p.ret1M;
          const positive = v != null && v >= 0;
          return (
            <div
              key={p.symbol}
              className="rounded border border-border bg-bg/40 px-2 py-1.5"
            >
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

      <div className="mt-3 flex items-center justify-end">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          {selected ? "Close detail ↑" : "Open detail →"}
        </span>
      </div>
    </Link>
  );
}

function SelectedEventPanel({
  ev,
  seriesMap,
}: {
  ev: Scored;
  seriesMap: Map<string, Series>;
}) {
  return (
    <section id="detail" className="mt-8 rounded-lg border border-accent/40 bg-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${CATEGORY_TONE[ev.category]}`}
            >
              {ev.category}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-zinc-600">
              importance {ev.importance}/3
            </span>
          </div>
          <h2 className="mt-1 text-xl font-semibold text-zinc-100">{ev.name}</h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">{ev.description}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-4xl tabular-nums text-accent">{ev.score}</div>
          <div className={`text-[11px] uppercase tracking-wider ${REGIME_TONE[ev.regime]}`}>
            {ev.regime}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <ExposureTable
          title="Exposed indices"
          rows={ev.indices}
          seriesMap={seriesMap}
        />
        <ExposureTable
          title="Exposed sectors"
          rows={ev.sectors}
          seriesMap={seriesMap}
        />
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
          Countries
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {ev.countries.map((c) => (
            <span
              key={c.label}
              className="rounded border border-border bg-bg/40 px-2 py-1 text-xs text-zinc-300"
            >
              {c.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function ExposureTable({
  title,
  rows,
  seriesMap,
}: {
  title: string;
  rows: Influence[];
  seriesMap: Map<string, Series>;
}) {
  return (
    <div>
      <h3 className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
        {title}
      </h3>
      <div className="overflow-hidden rounded border border-border bg-bg/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="px-2 py-1.5">Name</th>
              <th className="px-2 py-1.5">Sym</th>
              <th className="px-2 py-1.5 text-right">1D</th>
              <th className="px-2 py-1.5 text-right">1W</th>
              <th className="px-2 py-1.5 text-right">1M</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const s = row.ticker ? seriesMap.get(row.ticker) : undefined;
              const r = s ? multiPeriodReturns(s) : null;
              return (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="px-2 py-1.5 text-zinc-200">{row.label}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px] text-zinc-500">
                    {row.ticker ?? "—"}
                  </td>
                  <PctCell v={r?.["1D"] ?? null} />
                  <PctCell v={r?.["1W"] ?? null} />
                  <PctCell v={r?.["1M"] ?? null} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PctCell({ v }: { v: number | null }) {
  return (
    <td
      className={`px-2 py-1.5 text-right font-mono tabular-nums ${
        v == null ? "text-zinc-600" : v >= 0 ? "text-emerald-400" : "text-red-400"
      }`}
    >
      {v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`}
    </td>
  );
}
