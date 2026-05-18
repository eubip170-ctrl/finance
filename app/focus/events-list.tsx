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
  Macro: "text-sky-300",
  Geopolitics: "text-rose-300",
  Risk: "text-amber-300",
  Thematic: "text-violet-300",
};

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
    <div className="mt-2 border border-border bg-panel">
      <div className="flex items-center gap-2 border-b border-border bg-black/40 px-2 py-1">
        <span className="text-2xs font-bold uppercase tracking-widest text-accent">E1</span>
        <span className="text-2xs font-medium uppercase tracking-widest text-zinc-300">EVENTS</span>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {FILTERS.map((f) => {
            const active = f === filter;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`border px-1.5 py-0.5 text-2xs uppercase tracking-widest transition ${
                  active
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border text-zinc-500 hover:text-accent"
                }`}
              >
                {f} {counts[f]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filtered.map((ev) => (
          <EventCard key={ev.id} ev={ev} />
        ))}
      </div>
    </div>
  );
}

function EventCard({ ev }: { ev: EventCardData }) {
  return (
    <article className="bg-panel px-2 py-2">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-2xs uppercase tracking-widest">
            <span className={CATEGORY_TONE[ev.category]}>{ev.category}</span>
            <span className="text-zinc-600">IMP {ev.importance}/3</span>
          </div>
          <h3 className="mt-0.5 truncate text-xs font-medium uppercase text-zinc-100">
            {ev.name}
          </h3>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg tabular-nums text-accent">{ev.score}</div>
          <div className={`text-2xs uppercase tracking-widest ${REGIME_TEXT[ev.regime]}`}>
            {ev.regime}
          </div>
        </div>
      </header>

      <p className="mt-1 text-2xs text-zinc-500">{ev.description}</p>

      <div className="mt-2 h-1 w-full overflow-hidden bg-black">
        <div
          className={`h-full ${REGIME_BAR[ev.regime]}`}
          style={{ width: `${ev.score}%` }}
        />
      </div>

      <div className="mt-1 flex items-center justify-between text-2xs uppercase tracking-widest">
        <span className="text-zinc-600">
          MOM{" "}
          <span
            className={
              ev.momentum > 0 ? "text-pos" : ev.momentum < 0 ? "text-neg" : "text-zinc-400"
            }
          >
            {ev.momentum > 0 ? "▲" : ev.momentum < 0 ? "▼" : "●"}
          </span>
        </span>
        <span className="text-zinc-600">DIR <span className="text-zinc-300">{ev.direction}</span></span>
      </div>

      {ev.spark.length >= 2 && <Sparkline values={ev.spark} regime={ev.regime} />}

      <div className="mt-2 grid grid-cols-3 gap-1">
        {ev.proxyReturns.map((p) => {
          const v = p.ret1M;
          const positive = v != null && v >= 0;
          return (
            <div key={p.symbol} className="border border-border bg-black/40 px-1 py-0.5">
              <div className="font-mono text-2xs uppercase text-zinc-500">{p.symbol}</div>
              <div
                className={`font-mono text-2xs tabular-nums ${
                  v == null ? "text-zinc-700" : positive ? "text-pos" : "text-neg"
                }`}
              >
                {v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-end">
        <Link
          href={`/charts?symbol=${encodeURIComponent(ev.proxies[0] ?? "")}`}
          className="text-2xs uppercase tracking-widest text-zinc-600 hover:text-accent"
        >
          CHRT →
        </Link>
      </div>
    </article>
  );
}

function Sparkline({ values, regime }: { values: number[]; regime: Regime }) {
  const W = 300;
  const H = 28;
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
    regime === "panic" ? "#ff6b6b" : regime === "stress" ? "#fbbf24" : "#3ddc97";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-7 w-full" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.2} />
    </svg>
  );
}
