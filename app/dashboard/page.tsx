import Link from "next/link";
import { getManySeries, multiPeriodReturns, type Series } from "@/lib/markets/series";
import { Sparkline } from "@/components/dashboard/Sparkline";

export const dynamic = "force-dynamic";
export const revalidate = 600;

const PULSE: Array<{ symbol: string; label: string; group: string }> = [
  { symbol: "SPY", label: "S&P 500", group: "EQ" },
  { symbol: "QQQ", label: "Nasdaq 100", group: "EQ" },
  { symbol: "FEZ", label: "Stoxx 50", group: "EQ" },
  { symbol: "EWJ", label: "Japan", group: "EQ" },
  { symbol: "EEM", label: "EM", group: "EQ" },
  { symbol: "UUP", label: "DXY", group: "FX" },
  { symbol: "FXE", label: "EUR/USD", group: "FX" },
  { symbol: "TLT", label: "US 20Y", group: "RT" },
  { symbol: "IEF", label: "US 10Y", group: "RT" },
  { symbol: "GLD", label: "Gold", group: "CM" },
  { symbol: "USO", label: "WTI", group: "CM" },
  { symbol: "HYG", label: "HY Credit", group: "CR" },
];

const SECTORS: Array<{ symbol: string; label: string }> = [
  { symbol: "XLK", label: "Technology" },
  { symbol: "XLF", label: "Financials" },
  { symbol: "XLE", label: "Energy" },
  { symbol: "XLV", label: "Healthcare" },
  { symbol: "XLY", label: "Discretionary" },
  { symbol: "XLP", label: "Staples" },
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
  const bestMovers = movers.slice(0, 6);
  const worstMovers = movers.slice(-6).reverse();

  const stale = pulseRows.every((r) => r.last == null);

  return (
    <main className="px-3 py-3">
      <PageHeader code="DASH" title="MARKET DASHBOARD" right={stale ? "NO DATA" : null} />

      <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-2">
        <Panel code="P1" title="CROSS-ASSET PULSE">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4">
            {pulseRows.map((r) => (
              <PulseCard key={r.symbol} row={r} />
            ))}
          </div>
        </Panel>

        <Panel code="M1" title="TOP MOVERS · 1D">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <MoversList title="LEADERS" rows={bestMovers} />
            <MoversList title="LAGGARDS" rows={worstMovers} />
          </div>
        </Panel>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2">
        <Panel code="X1" title="PERFORMANCE MATRIX">
          <PerfMatrix rows={pulseRows} />
        </Panel>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-2">
        <Panel code="H1" title="SECTOR HEATMAP">
          <SectorHeatmap rows={sectorRows} />
        </Panel>
        <Panel code="L1" title="SECTOR LEADERBOARD">
          <PerfMatrix rows={sectorRows} />
        </Panel>
      </div>
    </main>
  );
}

function PageHeader({
  code,
  title,
  right,
}: {
  code: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border pb-1">
      <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
        {code}
      </span>
      <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">
        {title}
      </h1>
      {right && (
        <span className="ml-auto text-2xs uppercase tracking-widest text-neg">{right}</span>
      )}
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
        <span className="text-2xs font-bold uppercase tracking-widest text-accent">
          {code}
        </span>
        <span className="text-2xs font-medium uppercase tracking-widest text-zinc-300">
          {title}
        </span>
      </div>
      <div className="px-2 py-2">{children}</div>
    </div>
  );
}

function PulseCard({ row }: { row: Row }) {
  const d1 = row.ret["1D"];
  const positive = d1 != null && d1 >= 0;
  return (
    <div className="border border-border bg-black/30 px-2 py-1">
      <div className="flex items-baseline justify-between">
        <div className="text-2xs font-bold uppercase tracking-widest text-accent">
          {row.symbol}
        </div>
        <div className="text-2xs text-zinc-600">{row.group}</div>
      </div>
      <div className="truncate text-2xs uppercase text-zinc-400">{row.label}</div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div>
          <div className="font-mono text-sm tabular-nums text-zinc-100">
            {row.last != null ? fmt(row.last) : "—"}
          </div>
          <div className={`font-mono text-2xs tabular-nums ${positive ? "text-pos" : "text-neg"}`}>
            {fmtPct(d1)}
          </div>
        </div>
        <div className="w-16">
          <Sparkline values={row.series} positive={positive} width={64} height={22} />
        </div>
      </div>
    </div>
  );
}

function MoversList({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="border border-border bg-black/30">
      <div className="border-b border-border px-2 py-1 text-2xs uppercase tracking-widest text-zinc-500">
        {title}
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const d1 = r.ret["1D"];
          const positive = d1 != null && d1 >= 0;
          return (
            <li key={r.symbol} className="flex items-center justify-between gap-2 px-2 py-1 text-xs">
              <div className="min-w-0">
                <div className="font-mono text-2xs uppercase text-accent">{r.symbol}</div>
                <div className="truncate text-2xs text-zinc-400">{r.label}</div>
              </div>
              <div className={`font-mono tabular-nums ${positive ? "text-pos" : "text-neg"}`}>
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
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-2xs tabular-nums">
        <thead>
          <tr className="border-b border-border text-left uppercase tracking-widest text-zinc-500">
            <th className="px-2 py-1">TKR</th>
            <th className="px-2 py-1">NAME</th>
            {PERIODS.map((p) => (
              <th key={p} className="px-2 py-1 text-right">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol} className="border-b border-border/60 last:border-0 hover:bg-black/40">
              <td className="px-2 py-1 text-accent">{r.symbol}</td>
              <td className="px-2 py-1 text-zinc-300">{r.label}</td>
              {PERIODS.map((p) => {
                const v = r.ret[p];
                const positive = v != null && v >= 0;
                return (
                  <td
                    key={p}
                    className={`px-2 py-1 text-right ${
                      v == null ? "text-zinc-700" : positive ? "text-pos" : "text-neg"
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
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4">
      {rows.map((r) => {
        const v = r.ret["1D"];
        const intensity = v == null ? 0 : Math.min(Math.abs(v) / 3, 1);
        const positive = v != null && v >= 0;
        const bg = v == null
          ? "rgba(255,255,255,0.02)"
          : positive
            ? `rgba(61, 220, 151, ${0.08 + intensity * 0.45})`
            : `rgba(255, 107, 107, ${0.08 + intensity * 0.45})`;
        return (
          <div
            key={r.symbol}
            className="border border-border px-2 py-1"
            style={{ background: bg }}
          >
            <div className="text-2xs font-bold uppercase tracking-widest text-accent">
              {r.symbol}
            </div>
            <div className="truncate text-2xs uppercase text-zinc-400">{r.label}</div>
            <div
              className={`mt-1 font-mono text-xs tabular-nums ${
                v == null ? "text-zinc-700" : positive ? "text-pos" : "text-neg"
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

// keep Link import used for tree-shake bookkeeping
void Link;
