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
  YTD: 0,
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

export interface DashboardMeta {
  cached: boolean;
  updatedAt: string | null;
  source: string;
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

function periodStartBars(
  s: { dates: number[]; closes: number[] } | undefined,
  p: DashboardPeriod,
): number {
  if (!s) return 0;
  if (p === "YTD") {
    const year = new Date().getUTCFullYear();
    for (let i = 0; i < s.dates.length; i++) {
      if (new Date(s.dates[i] * 1000).getUTCFullYear() === year) {
        return s.dates.length - 1 - i;
      }
    }
    return 0;
  }
  return PERIOD_BARS[p];
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
  "#42A5F5",
  "#66BB6A",
  "#EC407A",
  "#FF7043",
  "#7E57C2",
  "#26A69A",
  "#FFA726",
  "#5C6BC0",
  "#D4E157",
  "#8E5CF7",
  "#00BCD4",
  "#A1887F",
  "#78909C",
];

/* ========= Page ========= */

export function DashboardClient({
  payload,
  meta,
}: {
  payload: DashboardPayload;
  meta?: DashboardMeta;
}) {
  const [period, setPeriod] = useState<DashboardPeriod>("1D");
  const [trackerCols, setTrackerCols] = useState<1 | 2 | 3>(2);
  const [visibleGroups, setVisibleGroups] = useState<Set<string>>(
    new Set(payload.groups.map((g) => g.key)),
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  const { series, groups, pulse, errors } = payload;

  const allTickerInfo = useMemo(() => {
    const map = new Map<string, { name: string; group: string }>();
    for (const g of groups) {
      for (const t of g.tickers) {
        if (!map.has(t.t)) map.set(t.t, { name: t.n, group: g.label });
      }
    }
    return map;
  }, [groups]);

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

  const movers = useMemo(() => {
    const valid = matrixRows.filter((r) => r.ret[period] != null);
    valid.sort((a, b) => (b.ret[period] ?? 0) - (a.ret[period] ?? 0));
    return {
      best: valid.slice(0, 6),
      worst: valid.slice(-6).reverse(),
    };
  }, [matrixRows, period]);

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

  const trackerHeight = trackerCols === 1 ? 260 : trackerCols === 2 ? 200 : 160;

  return (
    <main className="px-3 py-3">
      <PageHeader title="MARKET DASHBOARD" meta={meta} />

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

      <Section code="P1" title="CROSS-ASSET PULSE">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
          {pulseCards.map((c) => (
            <PulseCard key={c.symbol} card={c} period={period} />
          ))}
        </div>
      </Section>

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

      <Section code="M1" title={`TOP MOVERS · ${period}`}>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <MoversList title="LEADERS" rows={movers.best} period={period} tone="pos" />
          <MoversList title="LAGGARDS" rows={movers.worst} period={period} tone="neg" />
        </div>
      </Section>

      <Section code="X1" title="PERFORMANCE MATRIX">
        <PerfMatrix rows={matrixRows} highlight={period} />
      </Section>

      {sectorsGroup && (
        <Section code="H1" title={`SECTOR HEATMAP · ${period}`}>
          <SectorHeatmap
            tickers={sectorsGroup.tickers}
            series={series}
            period={period}
          />
        </Section>
      )}

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
                  key={`${g.key}-${period}`}
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
              key={`expanded-${expanded}-${period}`}
              group={groups.find((g) => g.key === expanded)!}
              series={series}
              period={period}
              height={560}
              defaultShowAll
            />
          </div>
        </div>
      )}
    </main>
  );
}

/* ========= Sub-components ========= */

function PageHeader({ title, meta }: { title: string; meta?: DashboardMeta }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border pb-1">
      <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
        DASH
      </span>
      <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">{title}</h1>
      {meta && (
        <span className="ml-auto text-2xs uppercase tracking-widest text-zinc-600">
          {meta.cached ? "CACHE" : "LIVE"}
          {meta.updatedAt && (
            <span className="ml-2 text-zinc-700">
              · {new Date(meta.updatedAt).toUTCString().slice(5, 22)}
            </span>
          )}
        </span>
      )}
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

type TrackerSort = "perf" | "ticker" | "name";

interface TrackerLine {
  t: string;
  n: string;
  values: number[];
  final: number;
}

function buildTracks(
  group: { tickers: Array<{ t: string; n: string }>; benchmark: string },
  series: Record<string, { dates: number[]; closes: number[] }>,
  period: DashboardPeriod,
): { tracks: TrackerLine[]; dates: number[] } {
  const bench = series[group.benchmark];
  if (!bench) return { tracks: [], dates: [] };
  const bars = periodStartBars(bench, period);
  const totalLen = bench.closes.length;
  if (bars <= 0 || totalLen < 2) return { tracks: [], dates: [] };

  const startIdx = Math.max(0, totalLen - 1 - bars);
  const sliceLen = totalLen - startIdx;
  const dates = bench.dates.slice(startIdx);

  const benchStart = bench.closes[startIdx];
  if (!benchStart) return { tracks: [], dates: [] };
  const benchSlice = bench.closes.slice(startIdx);

  const out: TrackerLine[] = [];
  for (const t of group.tickers) {
    const s = series[t.t];
    if (!s) continue;
    const sStart = s.closes.length - sliceLen;
    if (sStart < 0) continue;
    const tStart = s.closes[sStart];
    if (!tStart) continue;
    const values: number[] = new Array(sliceLen).fill(NaN);
    for (let i = 0; i < sliceLen; i++) {
      const ti = s.closes[sStart + i];
      const bi = benchSlice[i];
      if (!ti || !bi) continue;
      values[i] = (ti / tStart) / (bi / benchStart) * 100;
    }
    const final = values[values.length - 1];
    if (!Number.isFinite(final)) continue;
    out.push({ t: t.t, n: t.n, values, final });
  }
  return { tracks: out, dates };
}

function RelativePerfTracker({
  group,
  series,
  period,
  height,
  onExpand,
  defaultShowAll = false,
}: {
  group: { key: string; label: string; benchmark: string; tickers: Array<{ t: string; n: string }> };
  series: Record<string, { dates: number[]; closes: number[] }>;
  period: DashboardPeriod;
  height: number;
  onExpand?: () => void;
  defaultShowAll?: boolean;
}) {
  const { tracks, dates } = useMemo(
    () => buildTracks(group, series, period),
    [group, series, period],
  );

  const initialHidden = useMemo(() => {
    if (defaultShowAll || tracks.length <= 8) return new Set<string>();
    const sorted = [...tracks].sort((a, b) => b.final - a.final);
    const visible = new Set<string>([
      ...sorted.slice(0, 5).map((x) => x.t),
      ...sorted.slice(-3).map((x) => x.t),
    ]);
    return new Set(tracks.filter((x) => !visible.has(x.t)).map((x) => x.t));
  }, [tracks, defaultShowAll]);

  const [hidden, setHidden] = useState<Set<string>>(initialHidden);
  const [sort, setSort] = useState<TrackerSort>("perf");

  const visibleTracks = useMemo(
    () => tracks.filter((t) => !hidden.has(t.t)),
    [tracks, hidden],
  );

  const legendSorted = useMemo(() => {
    const out = [...tracks];
    if (sort === "perf") out.sort((a, b) => b.final - a.final);
    else if (sort === "ticker") out.sort((a, b) => a.t.localeCompare(b.t));
    else out.sort((a, b) => a.n.localeCompare(b.n));
    return out;
  }, [tracks, sort]);

  function toggle(t: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }
  function showOnly(t: string) {
    setHidden(new Set(tracks.filter((x) => x.t !== t).map((x) => x.t)));
  }
  function showAll() {
    setHidden(new Set());
  }
  function hideAll() {
    setHidden(new Set(tracks.map((x) => x.t)));
  }

  const colorMap = useMemo(() => {
    const m = new Map<string, string>();
    tracks.forEach((t, i) => m.set(t.t, PALETTE[i % PALETTE.length]));
    return m;
  }, [tracks]);

  if (tracks.length === 0) {
    return (
      <div className="border border-border bg-panel p-2">
        <div className="flex items-center justify-between border-b border-border pb-1">
          <span className="text-2xs font-bold uppercase tracking-widest text-zinc-300">
            {group.label}
          </span>
          <span className="text-2xs text-zinc-500">vs {group.benchmark}</span>
        </div>
        <p className="mt-2 text-2xs uppercase text-zinc-600">no data</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col border border-border bg-panel">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-2 py-1">
        <span className="text-2xs font-bold uppercase tracking-widest text-zinc-200">
          {group.label}
        </span>
        <span className="text-2xs text-zinc-500">
          vs {group.benchmark} · {period}
        </span>
        <span className="text-2xs text-zinc-600">
          {visibleTracks.length}/{tracks.length}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <span className="text-2xs uppercase tracking-widest text-zinc-600">SORT</span>
          {(["perf", "ticker", "name"] as TrackerSort[]).map((k) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`border px-1.5 py-0.5 text-2xs uppercase tracking-widest transition ${
                sort === k
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-zinc-500 hover:text-accent"
              }`}
            >
              {k}
            </button>
          ))}
          <button
            onClick={hidden.size > 0 ? showAll : hideAll}
            className="border border-border bg-panel px-1.5 py-0.5 text-2xs uppercase tracking-widest text-zinc-400 hover:border-accent hover:text-accent"
            title={hidden.size > 0 ? "Show all" : "Hide all"}
          >
            {hidden.size > 0 ? "ALL" : "NONE"}
          </button>
          {onExpand && (
            <button
              onClick={onExpand}
              className="border border-border bg-panel px-1.5 py-0.5 text-2xs uppercase tracking-widest text-zinc-400 hover:border-accent hover:text-accent"
              title="Expand"
            >
              ⛶
            </button>
          )}
        </div>
      </div>
      <TrackerChart
        tracks={visibleTracks}
        allLegend={legendSorted}
        hidden={hidden}
        colorMap={colorMap}
        dates={dates}
        height={height}
        benchmark={group.benchmark}
        onToggle={toggle}
        onShowOnly={showOnly}
      />
    </div>
  );
}

function TrackerChart({
  tracks,
  allLegend,
  hidden,
  colorMap,
  dates,
  height,
  benchmark,
  onToggle,
  onShowOnly,
}: {
  tracks: TrackerLine[];
  allLegend: TrackerLine[];
  hidden: Set<string>;
  colorMap: Map<string, string>;
  dates: number[];
  height: number;
  benchmark: string;
  onToggle: (t: string) => void;
  onShowOnly: (t: string) => void;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const len = dates.length;
  if (len < 2) {
    return (
      <div className="px-2 py-3 text-2xs uppercase text-zinc-600">not enough data</div>
    );
  }

  const W = 600;
  const H = height;
  const padL = 38;
  const padR = 6;
  const padT = 6;
  const padB = 18;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const all = tracks.flatMap((t) => t.values.filter((v) => Number.isFinite(v)));
  const yMin = tracks.length > 0 ? Math.min(...all, 100) : 80;
  const yMax = tracks.length > 0 ? Math.max(...all, 100) : 120;
  const span = yMax - yMin || 1;

  const xOf = (i: number) => padL + (i / (len - 1)) * innerW;
  const yOf = (v: number) => padT + ((yMax - v) / span) * innerH;

  function fmtDate(t: number) {
    const d = new Date(t * 1000);
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    if (relX < padL || relX > W - padR) {
      setHoverIdx(null);
      return;
    }
    const ratio = (relX - padL) / innerW;
    const idx = Math.max(0, Math.min(len - 1, Math.round(ratio * (len - 1))));
    setHoverIdx(idx);
  }

  const xTicks = [0, Math.floor(len / 2), len - 1];

  return (
    <div className="flex">
      <div className="relative flex-1" style={{ minWidth: 0 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          preserveAspectRatio="none"
          style={{ height: H, cursor: "crosshair" }}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <line x1={padL} x2={W - padR} y1={yOf(100)} y2={yOf(100)} stroke="#3a3a3f" strokeDasharray="2 3" />
          <line x1={padL} x2={W - padR} y1={padT} y2={padT} stroke="#262629" />
          <line x1={padL} x2={W - padR} y1={padT + innerH} y2={padT + innerH} stroke="#262629" />
          <line x1={padL} x2={padL} y1={padT} y2={padT + innerH} stroke="#262629" />
          <text x={padL - 4} y={yOf(yMax) + 3} fontSize={8} fill="#6b6b72" textAnchor="end">
            {yMax.toFixed(0)}
          </text>
          <text x={padL - 4} y={yOf(100) + 3} fontSize={8} fill="#f5a623" textAnchor="end">
            100
          </text>
          <text x={padL - 4} y={yOf(yMin) + 3} fontSize={8} fill="#6b6b72" textAnchor="end">
            {yMin.toFixed(0)}
          </text>
          {xTicks.map((i) => (
            <text key={i} x={xOf(i)} y={H - 4} fontSize={8} fill="#6b6b72" textAnchor="middle">
              {fmtDate(dates[i])}
            </text>
          ))}
          <text x={W - padR - 2} y={padT + 9} fontSize={8} fill="#6b6b72" textAnchor="end">
            vs {benchmark}
          </text>

          {tracks.map((tr) => {
            const stroke = colorMap.get(tr.t) ?? "#f5a623";
            let path = "";
            let started = false;
            for (let i = 0; i < tr.values.length; i++) {
              const v = tr.values[i];
              if (!Number.isFinite(v)) continue;
              path += `${started ? "L" : "M"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)} `;
              started = true;
            }
            return <path key={tr.t} d={path} fill="none" stroke={stroke} strokeWidth={1.3} />;
          })}

          {hoverIdx != null && (
            <>
              <line
                x1={xOf(hoverIdx)}
                x2={xOf(hoverIdx)}
                y1={padT}
                y2={padT + innerH}
                stroke="#6b6b72"
                strokeDasharray="2 3"
                strokeWidth={1}
              />
              {tracks.map((tr) => {
                const v = tr.values[hoverIdx];
                if (!Number.isFinite(v)) return null;
                const color = colorMap.get(tr.t) ?? "#f5a623";
                return (
                  <circle
                    key={`hov-${tr.t}`}
                    cx={xOf(hoverIdx)}
                    cy={yOf(v)}
                    r={2.5}
                    fill={color}
                  />
                );
              })}
            </>
          )}
        </svg>

        {hoverIdx != null && tracks.length > 0 && (
          <div
            className="pointer-events-none absolute top-1 left-10 z-10 max-h-[80%] overflow-y-auto border border-border bg-black/90 px-2 py-1 text-2xs font-mono"
            style={{ minWidth: 130 }}
          >
            <div className="mb-1 border-b border-border pb-0.5 text-zinc-500">
              {fmtDate(dates[hoverIdx])}
            </div>
            {tracks
              .map((tr) => ({ tr, v: tr.values[hoverIdx] }))
              .filter((x) => Number.isFinite(x.v))
              .sort((a, b) => (b.v as number) - (a.v as number))
              .slice(0, 12)
              .map(({ tr, v }) => {
                const color = colorMap.get(tr.t) ?? "#f5a623";
                const delta = (v as number) - 100;
                const positive = delta >= 0;
                return (
                  <div key={`tt-${tr.t}`} className="flex items-center gap-1">
                    <span
                      className="inline-block h-1.5 w-3 shrink-0"
                      style={{ background: color }}
                    />
                    <span className="uppercase text-accent">{tr.t}</span>
                    <span className={`ml-auto tabular-nums ${positive ? "text-pos" : "text-neg"}`}>
                      {positive ? "+" : ""}
                      {delta.toFixed(1)}
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <ul
        className="ml-1 flex w-32 shrink-0 flex-col gap-px overflow-y-auto border-l border-border"
        style={{ maxHeight: H }}
      >
        {allLegend.map((tr) => {
          const stroke = colorMap.get(tr.t) ?? "#f5a623";
          const isHidden = hidden.has(tr.t);
          const diff = tr.final - 100;
          const positive = diff >= 0;
          return (
            <li
              key={`lg-${tr.t}`}
              className={`flex cursor-pointer items-center gap-1 px-1 py-0.5 text-2xs ${
                isHidden ? "opacity-40" : ""
              } hover:bg-black/60`}
              onClick={() => onToggle(tr.t)}
              onDoubleClick={(e) => {
                e.preventDefault();
                onShowOnly(tr.t);
              }}
              title={`${tr.n} · click toggle · double-click solo`}
            >
              <span
                className="inline-block h-1.5 w-3 shrink-0"
                style={{ background: stroke }}
              />
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
