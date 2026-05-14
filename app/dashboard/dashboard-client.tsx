"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Columns2,
  Columns3,
  Square,
  Eye,
  EyeOff,
  Check,
  ExternalLink,
} from "lucide-react";

/* ========= Types ========= */

export type DashboardPeriod = "1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "3Y" | "5Y";

const PERIOD_KEYS: DashboardPeriod[] = [
  "1D",
  "5D",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
  "3Y",
  "5Y",
];

const PERIOD_BARS: Record<DashboardPeriod, number> = {
  "1D": 1,
  "5D": 5,
  "1M": 21,
  "3M": 63,
  "6M": 126,
  YTD: 0, // sentinel
  "1Y": 252,
  "3Y": 756,
  "5Y": 1260,
};

export interface DashboardPayload {
  groups: Array<{
    key: string;
    label: string;
    benchmark: string;
    tickers: Array<{ t: string; n: string }>;
  }>;
  pulse: string[];
  series: Record<string, { dates: number[]; closes: number[] }>;
  errors: string[];
}

/* ========= Helpers ========= */

function pctBars(closes: number[], nBack: number): number | null {
  const n = closes.length;
  if (n < 2 || nBack < 1 || n - 1 - nBack < 0) return null;
  const last = closes[n - 1];
  const prev = closes[n - 1 - nBack];
  if (!prev || prev === 0) return null;
  return ((last - prev) / prev) * 100;
}

function pctYTD(dates: number[], closes: number[]): number | null {
  if (closes.length < 2) return null;
  const year = new Date().getUTCFullYear();
  for (let i = 0; i < dates.length; i++) {
    const d = new Date(dates[i] * 1000);
    if (d.getUTCFullYear() === year) {
      const anchor = closes[i];
      if (!anchor) return null;
      const last = closes[closes.length - 1];
      return ((last - anchor) / anchor) * 100;
    }
  }
  return null;
}

function periodReturn(
  s: { dates: number[]; closes: number[] } | undefined,
  p: DashboardPeriod,
): number | null {
  if (!s) return null;
  if (p === "YTD") return pctYTD(s.dates, s.closes);
  return pctBars(s.closes, PERIOD_BARS[p]);
}

function fmtPct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtPrice(v: number) {
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(v) >= 10) return v.toFixed(2);
  return v.toFixed(4);
}

/* ========= Page ========= */

export function DashboardClient({ payload }: { payload: DashboardPayload }) {
  const [period, setPeriod] = useState<DashboardPeriod>("1D");
  const [trackerCols, setTrackerCols] = useState<1 | 2 | 3>(2);
  const [visibleGroups, setVisibleGroups] = useState<Set<string>>(
    new Set(payload.groups.map((g) => g.key)),
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  const { series, groups, pulse, errors } = payload;

  // Build flat ticker info for matrix / movers.
  const allTickerInfo = useMemo(() => {
    const map = new Map<string, { name: string; group: string }>();
    for (const g of groups) {
      for (const t of g.tickers) {
        if (!map.has(t.t)) map.set(t.t, { name: t.n, group: g.label });
      }
    }
    return map;
  }, [groups]);

  // Pulse strip cards.
  const pulseCards = useMemo(
    () =>
      pulse.map((t) => {
        const s = series[t];
        const last = s ? s.closes[s.closes.length - 1] : null;
        return {
          symbol: t,
          name: allTickerInfo.get(t)?.name ?? t,
          group: allTickerInfo.get(t)?.group ?? "",
          last,
          ret: periodReturn(s, period),
          sparkline: s ? s.closes.slice(-60) : [],
        };
      }),
    [pulse, series, period, allTickerInfo],
  );

  // Performance matrix: all ticker × all periods.
  const matrixRows = useMemo(
    () =>
      Array.from(allTickerInfo.entries()).map(([t, info]) => {
        const s = series[t];
        const ret: Record<DashboardPeriod, number | null> = {} as Record<
          DashboardPeriod,
          number | null
        >;
        for (const p of PERIOD_KEYS) ret[p] = periodReturn(s, p);
        return { symbol: t, name: info.name, group: info.group, ret };
      }),
    [allTickerInfo, series],
  );

  // Top movers — sorted by selected period.
  const movers = useMemo(() => {
    const valid = matrixRows.filter((r) => r.ret[period] != null);
    valid.sort((a, b) => (b.ret[period] ?? 0) - (a.ret[period] ?? 0));
    return {
      best: valid.slice(0, 6),
      worst: valid.slice(-6).reverse(),
    };
  }, [matrixRows, period]);

  // Sector heatmap — sectors group only (for the dedicated heatmap).
  const sectorsGroup = useMemo(() => groups.find((g) => g.key === "sectors"), [groups]);

  function toggleGroup(k: string) {
    setVisibleGroups((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }
  function toggleAll() {
    setVisibleGroups((prev) =>
      prev.size === groups.length ? new Set() : new Set(groups.map((g) => g.key)),
    );
  }

  const trackerHeight = trackerCols === 1 ? 220 : trackerCols === 2 ? 160 : 130;

  return (
    <main className="px-3 py-3">
      <PageHeader title="MARKET DASHBOARD" />

      {/* Global period selector */}
      <div className="mt-2 flex flex-wrap items-center gap-2 border border-border bg-panel px-2 py-1.5">
        <span className="text-2xs uppercase tracking-widest text-zinc-500">PERIOD</span>
        {PERIOD_KEYS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`border px-2 py-0.5 text-2xs font-bold uppercase tracking-widest transition ${
              period === p
                ? "border-accent bg-accent text-bg"
                : "border-border text-zinc-500 hover:text-accent"
            }`}
          >
            {p}
          </button>
        ))}
        {errors.length > 0 && (
          <span className="ml-auto text-2xs uppercase tracking-widest text-neg" title={errors.join(", ")}>
            {errors.length} TICKERS NO DATA
          </span>
        )}
      </div>

      {/* Cross-Asset Pulse */}
      <Section code="P1" title="CROSS-ASSET PULSE">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
          {pulseCards.map((c) => (
            <PulseCard key={c.symbol} card={c} period={period} />
          ))}
        </div>
      </Section>

      {/* Market context strip — link to Focus + Brain */}
      <Section code="MC" title="MARKET CONTEXT">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <ContextChip
            href="/focus"
            label="MACRO FOCUS"
            description="Aggregate pressure, regimes and per-event scores."
          />
          <ContextChip
            href="/brain"
            label="SECOND BRAIN"
            description="Live RSS ingest from Fed, ECB, BoE, Treasury, Reuters, FT."
          />
          <ContextChip
            href="/markets"
            label="NEWS WIRE"
            description="Recent macro headlines + watchlist quotes."
          />
        </div>
      </Section>

      {/* Top Movers · period */}
      <Section code="M1" title={`TOP MOVERS · ${period}`}>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <MoversList title="LEADERS" rows={movers.best} period={period} tone="pos" />
          <MoversList title="LAGGARDS" rows={movers.worst} period={period} tone="neg" />
        </div>
      </Section>

      {/* Performance Matrix */}
      <Section code="X1" title="PERFORMANCE MATRIX">
        <PerfMatrix rows={matrixRows} highlight={period} />
      </Section>

      {/* Sector heatmap (selected period) */}
      {sectorsGroup && (
        <Section code="H1" title={`SECTOR HEATMAP · ${period}`}>
          <SectorHeatmap
            tickers={sectorsGroup.tickers}
            series={series}
            period={period}
          />
        </Section>
      )}

      {/* Sector returns tables */}
      <Section code="L1" title="SECTOR RETURNS TABLES">
        <p className="text-2xs uppercase tracking-widest text-zinc-500 mb-2">
          Ranked tables per group, sorted on the selected period.
        </p>
        <div className="space-y-3">
          {groups.map((g) => (
            <GroupTable key={g.key} group={g} series={series} period={period} />
          ))}
        </div>
      </Section>

      {/* Relative Performance Trackers */}
      <Section
        code="T1"
        title="RELATIVE PERFORMANCE TRACKERS"
        right={
          <div className="flex items-center gap-3">
            <span className="text-2xs uppercase tracking-widest text-zinc-500">LAYOUT</span>
            <button
              onClick={() => setTrackerCols(1)}
              className={`border px-1.5 py-0.5 transition ${
                trackerCols === 1
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-zinc-500 hover:text-accent"
              }`}
              title="1 column"
            >
              <Square size={11} />
            </button>
            <button
              onClick={() => setTrackerCols(2)}
              className={`border px-1.5 py-0.5 transition ${
                trackerCols === 2
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-zinc-500 hover:text-accent"
              }`}
              title="2 columns"
            >
              <Columns2 size={11} />
            </button>
            <button
              onClick={() => setTrackerCols(3)}
              className={`border px-1.5 py-0.5 transition ${
                trackerCols === 3
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-zinc-500 hover:text-accent"
              }`}
              title="3 columns"
            >
              <Columns3 size={11} />
            </button>
            <button
              onClick={toggleAll}
              className="text-2xs uppercase tracking-widest text-zinc-500 hover:text-accent inline-flex items-center gap-1"
            >
              {visibleGroups.size === groups.length ? (
                <>
                  <EyeOff size={11} /> HIDE ALL
                </>
              ) : (
                <>
                  <Eye size={11} /> SHOW ALL
                </>
              )}
            </button>
          </div>
        }
      >
        <div className="mb-2 flex flex-wrap items-center gap-1 border-b border-border pb-2">
          {groups.map((g) => {
            const active = visibleGroups.has(g.key);
            return (
              <button
                key={g.key}
                onClick={() => toggleGroup(g.key)}
                className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-2xs uppercase tracking-widest transition ${
                  active
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border text-zinc-500 hover:text-accent"
                }`}
              >
                {active ? <Check size={10} /> : <span className="inline-block w-[10px]" />}
                {g.label}
              </button>
            );
          })}
        </div>
        {visibleGroups.size === 0 ? (
          <div className="border border-dashed border-border p-6 text-center text-2xs uppercase text-zinc-500">
            No group selected
          </div>
        ) : (
          <div
            className={`grid gap-2 ${
              trackerCols === 1
                ? "grid-cols-1"
                : trackerCols === 2
                  ? "grid-cols-1 lg:grid-cols-2"
                  : "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
            }`}
          >
            {groups
              .filter((g) => visibleGroups.has(g.key))
              .map((g) => (
                <RelativePerfTracker
                  key={g.key}
                  group={g}
                  series={series}
                  period={period}
                  height={trackerHeight}
                  onExpand={() => setExpanded(g.key)}
                />
              ))}
          </div>
        )}
      </Section>

      {/* Expand modal */}
      {expanded && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3"
          onClick={() => setExpanded(null)}
        >
          <div className="w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border border-border border-b-0 bg-panel px-2 py-1">
              <span className="text-2xs font-bold uppercase tracking-widest text-accent">
                EXPAND · {groups.find((g) => g.key === expanded)?.label}
              </span>
              <button
                onClick={() => setExpanded(null)}
                className="border border-border bg-panel px-1.5 py-0.5 text-2xs uppercase tracking-widest text-zinc-300 hover:border-accent hover:text-accent"
              >
                ✕ CLOSE
              </button>
            </div>
            <RelativePerfTracker
              group={groups.find((g) => g.key === expanded)!}
              series={series}
              period={period}
              height={520}
            />
          </div>
        </div>
      )}
    </main>
  );
}

/* ========= Sub-components ========= */

function PageHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border pb-1">
      <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
        DASH
      </span>
      <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">{title}</h1>
    </div>
  );
}

function Section({
  code,
  title,
  right,
  children,
}: {
  code: string;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-2 border border-border bg-panel">
      <div className="flex items-center gap-2 border-b border-border bg-black/40 px-2 py-1">
        <span className="text-2xs font-bold uppercase tracking-widest text-accent">{code}</span>
        <span className="text-2xs font-medium uppercase tracking-widest text-zinc-300">
          {title}
        </span>
        {right && <span className="ml-auto">{right}</span>}
      </div>
      <div className="px-2 py-2">{children}</div>
    </section>
  );
}

function PulseCard({
  card,
  period,
}: {
  card: {
    symbol: string;
    name: string;
    group: string;
    last: number | null;
    ret: number | null;
    sparkline: number[];
  };
  period: DashboardPeriod;
}) {
  const positive = card.ret != null && card.ret >= 0;
  return (
    <div className="border border-border bg-black/30 px-2 py-1">
      <div className="flex items-baseline justify-between">
        <span className="text-2xs font-bold uppercase tracking-widest text-accent">
          {card.symbol}
        </span>
        <span className="text-2xs text-zinc-600">{card.group}</span>
      </div>
      <div className="truncate text-2xs uppercase text-zinc-400">{card.name}</div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div>
          <div className="font-mono text-sm tabular-nums text-zinc-100">
            {card.last != null ? fmtPrice(card.last) : "—"}
          </div>
          <div className={`font-mono text-2xs tabular-nums ${positive ? "text-pos" : "text-neg"}`}>
            {fmtPct(card.ret)}{" "}
            <span className="text-zinc-600">{period}</span>
          </div>
        </div>
        <Spark values={card.sparkline} positive={positive} width={64} height={22} />
      </div>
    </div>
  );
}

function Spark({
  values,
  positive,
  width,
  height,
}: {
  values: number[];
  positive: boolean;
  width: number;
  height: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sx = (i: number) => (i / (values.length - 1)) * (width - 2) + 1;
  const sy = (v: number) =>
    max === min ? height / 2 : height - 2 - ((v - min) / (max - min)) * (height - 4);
  const d = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} preserveAspectRatio="none">
      <path d={d} fill="none" stroke={positive ? "#3ddc97" : "#ff6b6b"} strokeWidth={1.2} />
    </svg>
  );
}

function ContextChip({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-2 border border-border bg-black/30 p-2 transition hover:border-accent"
    >
      <ExternalLink size={11} className="mt-0.5 text-zinc-600 group-hover:text-accent" />
      <div className="min-w-0">
        <div className="text-2xs font-bold uppercase tracking-widest text-accent">{label}</div>
        <div className="text-2xs text-zinc-500">{description}</div>
      </div>
    </Link>
  );
}

function MoversList({
  title,
  rows,
  period,
  tone,
}: {
  title: string;
  rows: Array<{ symbol: string; name: string; group: string; ret: Record<DashboardPeriod, number | null> }>;
  period: DashboardPeriod;
  tone: "pos" | "neg";
}) {
  return (
    <div className="border border-border bg-black/30">
      <div className={`border-b border-border px-2 py-1 text-2xs uppercase tracking-widest ${tone === "pos" ? "text-pos" : "text-neg"}`}>
        {title}
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const v = r.ret[period];
          const positive = v != null && v >= 0;
          return (
            <li key={r.symbol} className="flex items-center justify-between gap-2 px-2 py-1 text-xs">
              <div className="min-w-0">
                <div className="font-mono text-2xs uppercase text-accent">{r.symbol}</div>
                <div className="truncate text-2xs text-zinc-400">{r.name}</div>
              </div>
              <div className={`font-mono tabular-nums ${positive ? "text-pos" : "text-neg"}`}>
                {fmtPct(v)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PerfMatrix({
  rows,
  highlight,
}: {
  rows: Array<{ symbol: string; name: string; group: string; ret: Record<DashboardPeriod, number | null> }>;
  highlight: DashboardPeriod;
}) {
  const [sortBy, setSortBy] = useState<DashboardPeriod>(highlight);
  const [dir, setDir] = useState<1 | -1>(-1);
  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const va = a.ret[sortBy] ?? -Infinity;
      const vb = b.ret[sortBy] ?? -Infinity;
      return (vb - va) * dir;
    });
    return out;
  }, [rows, sortBy, dir]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-2xs tabular-nums">
        <thead>
          <tr className="border-b border-border text-left uppercase tracking-widest text-zinc-500">
            <th className="px-2 py-1">TKR</th>
            <th className="px-2 py-1">NAME</th>
            <th className="px-2 py-1">GROUP</th>
            {PERIOD_KEYS.map((p) => {
              const isSort = p === sortBy;
              return (
                <th key={p} className="px-2 py-1 text-right">
                  <button
                    onClick={() => {
                      if (sortBy === p) setDir((d) => (d === 1 ? -1 : 1));
                      else {
                        setSortBy(p);
                        setDir(-1);
                      }
                    }}
                    className={`uppercase tracking-widest ${
                      isSort
                        ? "text-accent"
                        : p === highlight
                          ? "text-zinc-300"
                          : "text-zinc-500 hover:text-accent"
                    }`}
                  >
                    {p}
                    {isSort && (dir === -1 ? " ▼" : " ▲")}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.symbol} className="border-b border-border/60 last:border-0 hover:bg-black/40">
              <td className="px-2 py-1 text-accent">{r.symbol}</td>
              <td className="px-2 py-1 text-zinc-200">{r.name}</td>
              <td className="px-2 py-1 text-zinc-500">{r.group}</td>
              {PERIOD_KEYS.map((p) => {
                const v = r.ret[p];
                const positive = v != null && v >= 0;
                return (
                  <td
                    key={p}
                    className={`px-2 py-1 text-right ${
                      v == null
                        ? "text-zinc-700"
                        : positive
                          ? "text-pos"
                          : "text-neg"
                    } ${p === highlight ? "bg-accent/5" : ""}`}
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

function SectorHeatmap({
  tickers,
  series,
  period,
}: {
  tickers: Array<{ t: string; n: string }>;
  series: Record<string, { dates: number[]; closes: number[] }>;
  period: DashboardPeriod;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {tickers.map((t) => {
        const v = periodReturn(series[t.t], period);
        const intensity = v == null ? 0 : Math.min(Math.abs(v) / 10, 1);
        const positive = v != null && v >= 0;
        const bg = v == null
          ? "rgba(255,255,255,0.02)"
          : positive
            ? `rgba(61, 220, 151, ${0.08 + intensity * 0.45})`
            : `rgba(255, 107, 107, ${0.08 + intensity * 0.45})`;
        return (
          <div key={t.t} className="border border-border px-2 py-1" style={{ background: bg }}>
            <div className="text-2xs font-bold uppercase tracking-widest text-accent">{t.t}</div>
            <div className="truncate text-2xs uppercase text-zinc-400">{t.n}</div>
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

function GroupTable({
  group,
  series,
  period,
}: {
  group: { key: string; label: string; tickers: Array<{ t: string; n: string }> };
  series: Record<string, { dates: number[]; closes: number[] }>;
  period: DashboardPeriod;
}) {
  const [open, setOpen] = useState(true);
  const rows = group.tickers.map((t) => {
    const s = series[t.t];
    return {
      t: t.t,
      n: t.n,
      ret: periodReturn(s, period),
      ret1d: periodReturn(s, "1D"),
      ret1m: periodReturn(s, "1M"),
      retYtd: periodReturn(s, "YTD"),
      ret1y: periodReturn(s, "1Y"),
    };
  });
  rows.sort((a, b) => (b.ret ?? -Infinity) - (a.ret ?? -Infinity));

  return (
    <div className="border border-border bg-black/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-b border-border px-2 py-1 text-left hover:bg-black/50"
      >
        <span className="flex items-center gap-2">
          <span className="text-2xs font-bold uppercase tracking-widest text-accent">▸</span>
          <span className="text-2xs font-bold uppercase tracking-widest text-zinc-200">
            {group.label}
          </span>
          <span className="text-2xs text-zinc-600">{rows.length} TICKERS</span>
        </span>
        <span className="text-2xs text-zinc-500">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <table className="w-full font-mono text-2xs tabular-nums">
          <thead>
            <tr className="border-b border-border text-left uppercase tracking-widest text-zinc-500">
              <th className="px-2 py-1">TKR</th>
              <th className="px-2 py-1">NAME</th>
              <th className="px-2 py-1 text-right text-accent">{period}</th>
              <th className="px-2 py-1 text-right">1D</th>
              <th className="px-2 py-1 text-right">1M</th>
              <th className="px-2 py-1 text-right">YTD</th>
              <th className="px-2 py-1 text-right">1Y</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.t} className="border-b border-border/60 last:border-0 hover:bg-black/40">
                <td className="px-2 py-1 text-accent">{r.t}</td>
                <td className="px-2 py-1 text-zinc-200">{r.n}</td>
                <Td v={r.ret} bold />
                <Td v={r.ret1d} />
                <Td v={r.ret1m} />
                <Td v={r.retYtd} />
                <Td v={r.ret1y} />
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Td({ v, bold = false }: { v: number | null; bold?: boolean }) {
  const positive = v != null && v >= 0;
  return (
    <td
      className={`px-2 py-1 text-right ${
        v == null ? "text-zinc-700" : positive ? "text-pos" : "text-neg"
      } ${bold ? "font-bold" : ""}`}
    >
      {fmtPct(v)}
    </td>
  );
}

/* ========= Relative Performance Tracker ========= */

function RelativePerfTracker({
  group,
  series,
  period,
  height,
  onExpand,
}: {
  group: { key: string; label: string; benchmark: string; tickers: Array<{ t: string; n: string }> };
  series: Record<string, { dates: number[]; closes: number[] }>;
  period: DashboardPeriod;
  height: number;
  onExpand?: () => void;
}) {
  const bench = series[group.benchmark];
  const bars = period === "YTD"
    ? (() => {
        if (!bench) return 0;
        const year = new Date().getUTCFullYear();
        for (let i = 0; i < bench.dates.length; i++) {
          if (new Date(bench.dates[i] * 1000).getUTCFullYear() === year) {
            return bench.dates.length - 1 - i;
          }
        }
        return 0;
      })()
    : PERIOD_BARS[period];

  // For each ticker, build the rebased ratio series ticker/benchmark over the
  // visible period, normalised to 100 at the start.
  const tracks = useMemo(() => {
    if (!bench) return [];
    const out: Array<{ t: string; n: string; values: number[]; final: number }> = [];
    for (const t of group.tickers) {
      const s = series[t.t];
      if (!s) continue;
      const n = Math.min(s.closes.length, bench.closes.length);
      const start = Math.max(0, n - 1 - bars);
      const benchStart = bench.closes[bench.closes.length - n + start] ?? bench.closes[start];
      const tStart = s.closes[s.closes.length - n + start] ?? s.closes[start];
      if (!benchStart || !tStart) continue;
      const values: number[] = [];
      for (let i = start; i < n; i++) {
        const b = bench.closes[bench.closes.length - n + i];
        const ti = s.closes[s.closes.length - n + i];
        if (!b || !ti) {
          values.push(NaN);
          continue;
        }
        const ratio = (ti / tStart) / (b / benchStart);
        values.push(ratio * 100);
      }
      const final = values[values.length - 1] ?? 100;
      out.push({ t: t.t, n: t.n, values, final });
    }
    out.sort((a, b) => b.final - a.final);
    return out;
  }, [bench, group.tickers, series, bars]);

  if (!bench || tracks.length === 0) {
    return (
      <div className="border border-border bg-panel p-2">
        <div className="text-2xs font-bold uppercase tracking-widest text-zinc-300">
          {group.label}
        </div>
        <p className="mt-2 text-2xs uppercase text-zinc-600">no data</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col border border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border px-2 py-1">
        <span className="text-2xs font-bold uppercase tracking-widest text-zinc-200">
          {group.label}
        </span>
        <span className="text-2xs text-zinc-500">
          vs {group.benchmark} · {period}
        </span>
        {onExpand && (
          <button
            onClick={onExpand}
            className="ml-2 text-2xs uppercase tracking-widest text-zinc-500 hover:text-accent"
            title="Expand"
          >
            ⛶
          </button>
        )}
      </div>
      <TrackerChart tracks={tracks} height={height} benchmark={group.benchmark} />
    </div>
  );
}

function TrackerChart({
  tracks,
  height,
  benchmark,
}: {
  tracks: Array<{ t: string; n: string; values: number[]; final: number }>;
  height: number;
  benchmark: string;
}) {
  const W = 600;
  const H = height;
  // Color palette — line per ticker. Stable but rotating.
  const PALETTE = [
    "#f5a623",
    "#3ddc97",
    "#5aa8ff",
    "#e83e8c",
    "#9b6dff",
    "#f7d046",
    "#6dd3ff",
    "#ff7a59",
    "#26C6DA",
    "#AB47BC",
    "#FFB74D",
  ];
  const len = tracks[0]?.values.length ?? 0;
  if (len < 2) return <div className="px-2 py-3 text-2xs uppercase text-zinc-600">not enough data</div>;
  const all = tracks.flatMap((t) => t.values.filter((v) => Number.isFinite(v)));
  const yMin = Math.min(...all, 100);
  const yMax = Math.max(...all, 100);
  const span = yMax - yMin || 1;
  const padL = 38;
  const padR = 6;
  const padT = 6;
  const padB = 16;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const xOf = (i: number) => padL + (i / (len - 1)) * innerW;
  const yOf = (v: number) => padT + ((yMax - v) / span) * innerH;

  return (
    <div className="flex">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: H }}>
        {/* Grid lines */}
        <line x1={padL} x2={W - padR} y1={yOf(100)} y2={yOf(100)} stroke="#3a3a3f" strokeDasharray="2 3" />
        <line x1={padL} x2={W - padR} y1={padT} y2={padT} stroke="#262629" />
        <line x1={padL} x2={W - padR} y1={padT + innerH} y2={padT + innerH} stroke="#262629" />
        <line x1={padL} x2={padL} y1={padT} y2={padT + innerH} stroke="#262629" />
        <text x={padL - 4} y={yOf(yMax) + 3} fontSize={8} fill="#6b6b72" textAnchor="end">
          {yMax.toFixed(0)}
        </text>
        <text x={padL - 4} y={yOf(100) + 3} fontSize={8} fill="#6b6b72" textAnchor="end">
          100
        </text>
        <text x={padL - 4} y={yOf(yMin) + 3} fontSize={8} fill="#6b6b72" textAnchor="end">
          {yMin.toFixed(0)}
        </text>
        <text x={W - padR} y={H - 4} fontSize={8} fill="#6b6b72" textAnchor="end">
          vs {benchmark}
        </text>
        {tracks.map((tr, idx) => {
          const stroke = PALETTE[idx % PALETTE.length];
          let path = "";
          let started = false;
          for (let i = 0; i < tr.values.length; i++) {
            const v = tr.values[i];
            if (!Number.isFinite(v)) continue;
            path += `${started ? "L" : "M"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)} `;
            started = true;
          }
          return <path key={tr.t} d={path} fill="none" stroke={stroke} strokeWidth={1.2} />;
        })}
      </svg>
      <ul className="ml-1 flex w-28 shrink-0 flex-col gap-px overflow-y-auto border-l border-border" style={{ maxHeight: H }}>
        {tracks.map((tr, idx) => {
          const stroke = PALETTE[idx % PALETTE.length];
          const diff = tr.final - 100;
          const positive = diff >= 0;
          return (
            <li key={tr.t} className="flex items-center gap-1 px-1 py-0.5 text-2xs">
              <span className="inline-block h-1.5 w-3 shrink-0" style={{ background: stroke }} />
              <span className="font-mono uppercase text-accent">{tr.t}</span>
              <span className={`ml-auto font-mono tabular-nums ${positive ? "text-pos" : "text-neg"}`}>
                {positive ? "+" : ""}
                {diff.toFixed(1)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
