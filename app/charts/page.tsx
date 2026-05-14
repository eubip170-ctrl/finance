import Link from "next/link";
import { getSeries, sma, ema } from "@/lib/markets/series";
import { PriceChart } from "@/components/charts/PriceChart";

export const dynamic = "force-dynamic";
export const revalidate = 600;

const PRESETS: Array<{ symbol: string; label: string }> = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "Nasdaq 100" },
  { symbol: "FEZ", label: "Euro Stoxx 50" },
  { symbol: "EWJ", label: "Japan" },
  { symbol: "GLD", label: "Gold" },
  { symbol: "USO", label: "Crude WTI" },
  { symbol: "UUP", label: "Dollar Index" },
  { symbol: "TLT", label: "US 20Y Tsy" },
  { symbol: "SMH", label: "Semis ETF" },
  { symbol: "AAPL", label: "Apple" },
];

const RANGES: Array<{ key: string; days: number }> = [
  { key: "1mo", days: 35 },
  { key: "3mo", days: 100 },
  { key: "6mo", days: 200 },
  { key: "1y", days: 380 },
  { key: "2y", days: 760 },
  { key: "5y", days: 1850 },
];

type SP = { searchParams?: Promise<{ symbol?: string; range?: string }> };

export default async function ChartsPage(props: SP) {
  const sp = (await props.searchParams) ?? {};
  const symbol = (sp.symbol ?? "SPY").toUpperCase();
  const rangeKey = RANGES.find((r) => r.key === sp.range)?.key ?? "1y";
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[3];

  const series = await getSeries(symbol, range.days);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Home
      </Link>
      <div className="mt-2 flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold">Charts</h1>
        <span className="text-xs uppercase tracking-wider text-zinc-500">
          technical analysis
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">
        Price chart with SMA / EMA overlays, momentum indicators and drawdown.
        Pick a preset or pass any Yahoo symbol via{" "}
        <code className="text-accent">?symbol=AAPL</code>.
      </p>

      {/* Preset chips */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">
          Symbols
        </span>
        {PRESETS.map((p) => {
          const active = p.symbol === symbol;
          return (
            <Link
              key={p.symbol}
              href={`/charts?symbol=${encodeURIComponent(p.symbol)}&range=${range.key}`}
              className={`rounded border px-2 py-1 text-xs ${
                active
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-panel text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      {/* Range chips */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">
          Range
        </span>
        {RANGES.map((r) => {
          const active = r.key === range.key;
          return (
            <Link
              key={r.key}
              href={`/charts?symbol=${encodeURIComponent(symbol)}&range=${r.key}`}
              className={`rounded border px-2 py-1 text-xs ${
                active
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-panel text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {r.key}
            </Link>
          );
        })}
      </div>

      {!series ? (
        <div className="mt-8 rounded-md border border-amber-900 bg-amber-950/40 p-3 text-sm text-amber-300">
          No data for <code>{symbol}</code>. Check that <code>MARKETSTACK_API_KEY</code>{" "}
          is set and the symbol is supported (US-listed equities and ETFs).
        </div>
      ) : (
        <ChartBody symbol={symbol} series={series} />
      )}
    </main>
  );
}

function ChartBody({
  symbol,
  series,
}: {
  symbol: string;
  series: NonNullable<Awaited<ReturnType<typeof getSeries>>>;
}) {
  const closes = series.closes;
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const ema20 = ema(closes, 20);

  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2] ?? last;
  const changePct = prev ? ((last - prev) / prev) * 100 : 0;

  // Indicators (last values)
  const sma20Last = lastNonNull(sma20);
  const sma50Last = lastNonNull(sma50);
  const ema20Last = lastNonNull(ema20);

  // Realised vol (annualised, daily log returns)
  const vol = realisedVol(closes);

  // Drawdown series
  const dd = drawdown(closes);
  const maxDD = Math.min(...dd) * 100;

  // 52w high/low approximations (use up to last 252)
  const last252 = closes.slice(-252);
  const hi52 = Math.max(...last252);
  const lo52 = Math.min(...last252);
  const posInRange = ((last - lo52) / (hi52 - lo52)) * 100;

  return (
    <>
      <header className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">
            {symbol}
            {series.meta.shortName ? ` · ${series.meta.shortName}` : ""}
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <div className="font-mono text-3xl tabular-nums text-zinc-100">
              {last.toFixed(2)}
            </div>
            <div
              className={`font-mono text-sm ${
                changePct >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {changePct >= 0 ? "+" : ""}
              {changePct.toFixed(2)}%
            </div>
          </div>
        </div>
        <Legend />
      </header>

      <section className="mt-4 rounded-lg border border-border bg-panel p-3">
        <PriceChart
          closes={closes}
          timestamps={series.timestamps}
          overlays={[
            { values: sma20, color: "#60a5fa", label: "SMA20" },
            { values: sma50, color: "#a78bfa", label: "SMA50" },
            { values: ema20, color: "#34d399", label: "EMA20" },
          ]}
        />
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <Indicator label="Last close" value={last.toFixed(2)} />
        <Indicator
          label="Δ 1D"
          value={`${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`}
          tone={changePct >= 0 ? "pos" : "neg"}
        />
        <Indicator
          label="SMA 20"
          value={sma20Last != null ? sma20Last.toFixed(2) : "—"}
        />
        <Indicator
          label="SMA 50"
          value={sma50Last != null ? sma50Last.toFixed(2) : "—"}
        />
        <Indicator
          label="EMA 20"
          value={ema20Last != null ? ema20Last.toFixed(2) : "—"}
        />
        <Indicator
          label="Vol (ann.)"
          value={vol != null ? `${(vol * 100).toFixed(1)}%` : "—"}
        />
        <Indicator
          label="Max DD"
          value={`${maxDD.toFixed(1)}%`}
          tone={maxDD <= -20 ? "neg" : "neutral"}
        />
        <Indicator label="52W range" value={`${posInRange.toFixed(0)}%`} />
      </section>

      {/* Drawdown chart */}
      <section className="mt-6">
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
            Drawdown
          </h2>
          <span className="rounded border border-border bg-panel px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
            DD
          </span>
        </div>
        <div className="rounded-lg border border-border bg-panel p-3">
          <DrawdownChart values={dd} timestamps={series.timestamps} />
        </div>
      </section>

      {/* Returns by window */}
      <section className="mt-6">
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
            Returns by window
          </h2>
          <span className="rounded border border-border bg-panel px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
            WIN
          </span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-2">Window</th>
                <th className="px-3 py-2 text-right">Return</th>
                <th className="px-3 py-2 text-right">Annualised</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "1 day", n: 1, ann: 252 },
                { label: "5 days", n: 5, ann: 50 },
                { label: "21 days", n: 21, ann: 12 },
                { label: "63 days", n: 63, ann: 4 },
                { label: "126 days", n: 126, ann: 2 },
                { label: "252 days", n: 252, ann: 1 },
              ].map((w) => {
                const r = windowReturn(closes, w.n);
                const annual = r == null ? null : (1 + r / 100) ** w.ann - 1;
                return (
                  <tr key={w.label} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-zinc-300">{w.label}</td>
                    <td
                      className={`px-3 py-2 text-right font-mono tabular-nums ${
                        r == null
                          ? "text-zinc-600"
                          : r >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                      }`}
                    >
                      {r == null ? "—" : `${r >= 0 ? "+" : ""}${r.toFixed(2)}%`}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono tabular-nums ${
                        annual == null
                          ? "text-zinc-600"
                          : annual >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                      }`}
                    >
                      {annual == null
                        ? "—"
                        : `${annual >= 0 ? "+" : ""}${(annual * 100).toFixed(2)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px]">
      <LegendDot color="#d4af37" label="Price" />
      <LegendDot color="#60a5fa" label="SMA 20" />
      <LegendDot color="#a78bfa" label="SMA 50" />
      <LegendDot color="#34d399" label="EMA 20" />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-zinc-400">
      <span
        className="inline-block h-2 w-3"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function Indicator({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "neutral";
}) {
  const toneClass =
    tone === "pos"
      ? "text-emerald-400"
      : tone === "neg"
        ? "text-red-400"
        : "text-zinc-100";
  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-1 font-mono text-base tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function DrawdownChart({
  values,
  timestamps,
}: {
  values: number[];
  timestamps: number[];
}) {
  if (values.length < 2) return <div className="text-sm text-zinc-500">No data.</div>;
  const W = 1000;
  const H = 140;
  const padL = 40;
  const padR = 8;
  const padT = 8;
  const padB = 18;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const min = Math.min(...values);
  const max = 0;
  const span = max - min || 1;
  const stepX = innerW / (values.length - 1);
  const xOf = (i: number) => padL + i * stepX;
  const yOf = (v: number) => padT + ((max - v) / span) * innerH;
  const path =
    `M ${xOf(0).toFixed(2)},${yOf(values[0]).toFixed(2)} ` +
    values
      .map((v, i) => `L ${xOf(i).toFixed(2)},${yOf(v).toFixed(2)}`)
      .join(" ") +
    ` L ${xOf(values.length - 1).toFixed(2)},${yOf(0).toFixed(2)} Z`;

  const tsFmt = (t: number) => {
    const d = new Date(t * 1000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  };
  const xTicks = [0, Math.floor(values.length / 2), values.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <line x1={padL} x2={W - padR} y1={padT} y2={padT} stroke="#1f1f23" />
      <line x1={padL} x2={W - padR} y1={padT + innerH / 2} y2={padT + innerH / 2} stroke="#1f1f23" strokeDasharray="2,3" />
      <line x1={padL} x2={W - padR} y1={padT + innerH} y2={padT + innerH} stroke="#1f1f23" />
      <text x={padL - 4} y={padT + 3} fontSize={9} fill="#7a7a82" textAnchor="end">0%</text>
      <text x={padL - 4} y={padT + innerH + 3} fontSize={9} fill="#7a7a82" textAnchor="end">
        {(min * 100).toFixed(1)}%
      </text>
      {xTicks.map((i) => (
        <text key={i} x={xOf(i)} y={H - 4} fontSize={9} fill="#7a7a82" textAnchor="middle">
          {tsFmt(timestamps[i] ?? 0)}
        </text>
      ))}
      <path d={path} fill="rgba(248,113,113,0.15)" stroke="#f87171" strokeWidth={1} />
    </svg>
  );
}

// Helpers

function lastNonNull(arr: Array<number | null>): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return arr[i];
  }
  return null;
}

function realisedVol(closes: number[]): number | null {
  if (closes.length < 2) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (rets.length === 0) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  return Math.sqrt(variance * 252);
}

function drawdown(closes: number[]): number[] {
  const out: number[] = [];
  let peak = closes[0] ?? 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    out.push(peak > 0 ? c / peak - 1 : 0);
  }
  return out;
}

function windowReturn(closes: number[], n: number): number | null {
  if (closes.length <= n) return null;
  const a = closes[closes.length - 1 - n];
  const b = closes[closes.length - 1];
  if (!a || a === 0) return null;
  return ((b - a) / a) * 100;
}
