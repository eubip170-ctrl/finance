"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type Category = "Macro" | "Geopolitics" | "Risk" | "Thematic";
export type Regime = "calm" | "stress" | "panic";

export type EventCardData = {
  id: string;
  name: string;
  category: Category;
  importance: 1 | 2 | 3;
  description: string;
  direction: "abs" | "risk-off";
  proxies: string[];
  score: number;
  momentum: 1 | 0 | -1;
  regime: Regime;
  proxyReturns: Array<{ symbol: string; ret1M: number | null }>;
  spark: number[];
};

const CATEGORY_TONE: Record<Category, string> = {
  Macro: "text-sky-300 border-sky-900/60 bg-sky-950/40",
  Geopolitics: "text-rose-300 border-rose-900/60 bg-rose-950/40",
  Risk: "text-amber-300 border-amber-900/60 bg-amber-950/40",
  Thematic: "text-violet-300 border-violet-900/60 bg-violet-950/40",
};

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

const FILTERS: Array<Category | "All"> = [
  "All",
  "Macro",
  "Geopolitics",
  "Risk",
  "Thematic",
];

export function FocusEventsList({ events }: { events: EventCardData[] }) {
  const [filter, setFilter] = useState<Category | "All">("All");

  const counts = useMemo(() => {
    const out: Record<Category | "All", number> = {
      All: events.length,
      Macro: 0,
      Geopolitics: 0,
      Risk: 0,
      Thematic: 0,
    };
    for (const e of events) out[e.category] += 1;
    return out;
  }, [events]);

  const filtered = useMemo(
    () => (filter === "All" ? events : events.filter((e) => e.category === filter)),
    [filter, events],
  );

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          Filter
        </span>
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded border px-2 py-1 text-[11px] uppercase tracking-wider transition ${
                active
                  ? "border-accent/60 bg-accent/10 text-accent"
                  : "border-border bg-panel text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {f} ({counts[f]})
            </button>
          );
        })}
      </div>

      <section className="mt-4">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
            {filter === "All" ? "All events" : `${filter} events`}
          </h2>
          <span className="rounded border border-border bg-panel px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
            {filtered.length}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((ev) => (
            <EventCard key={ev.id} ev={ev} />
          ))}
        </div>
      </section>
    </>
  );
}

function EventCard({ ev }: { ev: EventCardData }) {
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
          <div className={`text-[10px] uppercase tracking-wider ${REGIME_TEXT[ev.regime]}`}>
            {ev.regime}
          </div>
        </div>
      </header>

      <p className="mt-2 text-sm text-zinc-400">{ev.description}</p>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-zinc-800">
        <div
          className={`h-full ${REGIME_BAR[ev.regime]}`}
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
          direction: <span className="text-zinc-300">{ev.direction}</span>
        </span>
      </div>

      {ev.spark.length >= 2 && <Sparkline values={ev.spark} regime={ev.regime} />}

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

      <div className="mt-3 flex justify-end">
        <Link
          href={`/charts?symbol=${encodeURIComponent(ev.proxies[0] ?? "")}`}
          className="text-[11px] uppercase tracking-wider text-zinc-500 hover:text-accent"
        >
          open detail →
        </Link>
      </div>
    </article>
  );
}

function Sparkline({ values, regime }: { values: number[]; regime: Regime }) {
  const W = 300;
  const H = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sx = (i: number) =>
    values.length <= 1 ? 0 : (i / (values.length - 1)) * (W - 4) + 2;
  const sy = (v: number) =>
    max === min ? H / 2 : H - 2 - ((v - min) / (max - min)) * (H - 4);
  const d = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`)
    .join(" ");
  const stroke =
    regime === "panic" ? "#f87171" : regime === "stress" ? "#fbbf24" : "#34d399";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-10 w-full" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.2} />
    </svg>
  );
}
