import Link from "next/link";
import { getManySeries, multiPeriodReturns, type Series } from "@/lib/markets/series";
import { Sparkline } from "@/components/dashboard/Sparkline";

export const dynamic = "force-dynamic";
export const revalidate = 600;

/**
 * Cross-asset pulse — one representative ETF per major asset bucket.
 * MarketStack v2 only exposes US-listed equities/ETFs, so we proxy indices,
 * commodities and FX through their liquid US ETF equivalents (same convention
 * used by medge).
 */
const PULSE: Array<{ symbol: string; label: string; group: string }> = [
  { symbol: "SPY", label: "S&P 500", group: "Equities" },
  { symbol: "QQQ", label: "Nasdaq 100", group: "Equities" },
  { symbol: "FEZ", label: "Euro Stoxx 50", group: "Equities" },
  { symbol: "EWJ", label: "Japan", group: "Equities" },
  { symbol: "EEM", label: "EM Equities", group: "Equities" },
  { symbol: "UUP", label: "Dollar Index", group: "FX" },
  { symbol: "FXE", label: "EUR/USD", group: "FX" },
  { symbol: "TLT", label: "US 20Y Treasury", group: "Rates" },
  { symbol: "IEF", label: "US 7-10Y Treasury", group: "Rates" },
  { symbol: "GLD", label: "Gold", group: "Commodities" },
  { symbol: "USO", label: "WTI Crude", group: "Commodities" },
  { symbol: "HYG", label: "US High Yield", group: "Credit" },
];

/** Sector ETFs — used by the heatmap and the leaderboard. */
const SECTORS: Array<{ symbol: string; label: string }> = [
  { symbol: "XLK", label: "Technology" },
  { symbol: "XLF", label: "Financials" },
  { symbol: "XLE", label: "Energy" },
  { symbol: "XLV", label: "Health Care" },
  { symbol: "XLY", label: "Cons. Discretionary" },
  { symbol: "XLP", label: "Cons. Staples" },
  { symbol: "XLI", label: "Industrials" },
  { symbol: "XLU", label: "Utilities" },
  { symbol: "XLB", label: "Materials" },
  { symbol: "XLRE", label: "Real Estate" },
  { symbol: "XLC", label: "Communication" },
];

type Row = {
  symbol: string;
  label: string;
  group?: string;
  last: number | null;
  ret: Record<string, number | null>;
  series: number[];
};

function buildRow(
  s: Series | undefined,
  symbol: string,
  label: string,
  group?: string,
): Row {
  if (!s) {
    return {
      symbol,
      label,
      group,
      last: null,
      ret: { "1D": null, "1W": null, "1M": null, "3M": null, YTD: null, "1Y": null },
      series: [],
    };
  }
  return {
    symbol,
    label,
    group,
    last: s.closes[s.closes.length - 1],
    ret: multiPeriodReturns(s),
    series: s.closes.slice(-60),
  };
}

export default async function DashboardPage() {
  const pulseSyms = PULSE.map((p) => p.symbol);
  const sectorSyms = SECTORS.map((s) => s.symbol);
  const [pulseData, sectorData] = await Promise.all([
    getManySeries(pulseSyms, 400),
    getManySeries(sectorSyms, 400),
  ]);
  const pulseMap = new Map(pulseData.map((s) => [s.symbol, s]));
  const sectorMap = new Map(sectorData.map((s) => [s.symbol, s]));

  const pulseRows: Row[] = PULSE.map((p) =>
    buildRow(pulseMap.get(p.symbol), p.symbol, p.label, p.group),
  );
  const sectorRows: Row[] = SECTORS.map((s) =>
    buildRow(sectorMap.get(s.symbol), s.symbol, s.label),
  );

  const movers = [...pulseRows, ...sectorRows]
    .filter((r) => r.ret["1D"] != null)
    .sort((a, b) => (b.ret["1D"] ?? 0) - (a.ret["1D"] ?? 0));
  const bestMovers = movers.slice(0, 5);
  const worstMovers = movers.slice(-5).reverse();

  const stale = pulseRows.every((r) => r.last == null);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Home
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">Market Dashboard</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">
        Cross-asset snapshot: equities, FX, rates, commodities, credit and crypto.
        Sector heatmap and top movers refreshed every 10 minutes.
      </p>

      {stale && (
        <div className="mt-6 rounded-md border border-amber-900 bg-amber-950/40 p-3 text-sm text-amber-300">
          No data from MarketStack. Check that <code>MARKETSTACK_API_KEY</code> is
          configured and the quota has not been exhausted.
        </div>
      )}

      {/* Cross-Asset Pulse */}
      <Section title="Cross-Asset Pulse" badge="PULSE">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {pulseRows.map((r) => (
            <PulseCard key={r.symbol} row={r} />
          ))}
        </div>
      </Section>

      {/* Top Movers */}
      <Section title="Top Movers · 1D" badge="MOMENTUM">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MoversList title="Leaders" rows={bestMovers} />
          <MoversList title="Laggards" rows={worstMovers} />
        </div>
      </Section>

      {/* Performance Matrix */}
      <Section title="Performance Matrix" badge="MATRIX">
        <PerfMatrix rows={pulseRows} />
      </Section>

      {/* Sector Heatmap */}
      <Section title="Sector Heatmap" badge="SECTORS">
        <SectorHeatmap rows={sectorRows} />
      </Section>

      {/* Sector Returns Table */}
      <Section title="Sector Returns" badge="LEADERBOARD">
        <PerfMatrix rows={sectorRows} />
      </Section>
    </main>
  );
}

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
          {title}
        </h2>
        {badge && (
          <span className="rounded border border-border bg-panel px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function PulseCard({ row }: { row: Row }) {
  const d1 = row.ret["1D"];
  const positive = d1 != null && d1 >= 0;
  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-wide text-zinc-500">{row.symbol}</div>
        <div className="text-[10px] text-zinc-600">{row.group}</div>
      </div>
      <div className="mt-1 truncate text-sm text-zinc-200">{row.label}</div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <div className="text-base text-zinc-100">
            {row.last != null ? fmt(row.last) : "—"}
          </div>
          <div className={`text-xs ${positive ? "text-emerald-400" : "text-red-400"}`}>
            {fmtPct(d1)}
          </div>
        </div>
        <div className="w-20">
          <Sparkline values={row.series} positive={positive} width={80} height={28} />
        </div>
      </div>
    </div>
  );
}

function MoversList({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">{title}</div>
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const d1 = r.ret["1D"];
          const positive = d1 != null && d1 >= 0;
          return (
            <li key={r.symbol} className="flex items-center justify-between py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate text-zinc-200">{r.label}</div>
                <div className="text-[10px] uppercase text-zinc-600">{r.symbol}</div>
              </div>
              <div className={`font-mono text-sm ${positive ? "text-emerald-400" : "text-red-400"}`}>
                {fmtPct(d1)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const PERIODS: Array<keyof Row["ret"]> = ["1D", "1W", "1M", "3M", "YTD", "1Y"];

function PerfMatrix({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-panel">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-zinc-500">
            <th className="px-3 py-2">Ticker</th>
            <th className="px-3 py-2">Name</th>
            {PERIODS.map((p) => (
              <th key={p} className="px-3 py-2 text-right">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol} className="border-b border-border last:border-0">
              <td className="px-3 py-2 font-mono text-xs text-zinc-400">{r.symbol}</td>
              <td className="px-3 py-2 text-zinc-200">{r.label}</td>
              {PERIODS.map((p) => {
                const v = r.ret[p];
                const positive = v != null && v >= 0;
                return (
                  <td
                    key={p}
                    className={`px-3 py-2 text-right font-mono tabular-nums ${
                      v == null
                        ? "text-zinc-600"
                        : positive
                          ? "text-emerald-400"
                          : "text-red-400"
                    }`}
                  >
                    {fmtPct(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectorHeatmap({ rows }: { rows: Row[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {rows.map((r) => {
        const v = r.ret["1D"];
        const intensity = v == null ? 0 : Math.min(Math.abs(v) / 3, 1);
        const positive = v != null && v >= 0;
        const bg = v == null
          ? "rgba(255,255,255,0.02)"
          : positive
            ? `rgba(52, 211, 153, ${0.08 + intensity * 0.4})`
            : `rgba(248, 113, 113, ${0.08 + intensity * 0.4})`;
        return (
          <div
            key={r.symbol}
            className="rounded-lg border border-border p-3"
            style={{ background: bg }}
          >
            <div className="text-xs uppercase tracking-wide text-zinc-500">{r.symbol}</div>
            <div className="mt-1 truncate text-sm text-zinc-200">{r.label}</div>
            <div
              className={`mt-2 font-mono text-base ${
                v == null ? "text-zinc-600" : positive ? "text-emerald-300" : "text-red-300"
              }`}
            >
              {fmtPct(v)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function fmt(n: number) {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(n) >= 10) return n.toFixed(2);
  return n.toFixed(4);
}

function fmtPct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}
