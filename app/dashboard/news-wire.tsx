"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Newspaper, RefreshCw, ExternalLink } from "lucide-react";

interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string | null;
  publishedAt: string;
  createdAt: string;
}

interface NewsResponse {
  items: NewsItem[];
  sources: string[];
  total: number;
  error?: string;
}

const REFRESH_MS = 5 * 60 * 1000;
const DEFAULT_LIMIT = 24;

export function NewsWire() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        limit: String(DEFAULT_LIMIT),
        sinceDays: "7",
      });
      if (filter) params.set("source", filter);
      const res = await fetch(`/api/brain/news?${params.toString()}`, { cache: "no-store" });
      const j = (await res.json()) as NewsResponse;
      if (!res.ok) throw new Error(j.error || "failed");
      setItems(j.items ?? []);
      // Only refresh the chip list on the unfiltered call so removing a filter
      // doesn't accidentally collapse the chip set.
      if (!filter) setSources(j.sources ?? []);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <section className="mt-2 border border-border bg-panel">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-black/40 px-2 py-1">
        <span className="text-2xs font-bold uppercase tracking-widest text-accent">N1</span>
        <span className="text-2xs font-medium uppercase tracking-widest text-zinc-300">
          NEWS WIRE
        </span>
        <Newspaper size={11} className="text-zinc-500" />
        <div className="flex flex-wrap items-center gap-1">
          <Chip active={filter === ""} onClick={() => setFilter("")}>
            ALL
          </Chip>
          {sources.slice(0, 12).map((s) => (
            <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>
              {s}
            </Chip>
          ))}
        </div>
        <span className="ml-auto flex items-center gap-2 text-2xs uppercase tracking-widest text-zinc-600">
          {lastUpdated && (
            <span className="text-zinc-700">{relTime(lastUpdated)}</span>
          )}
          <button
            onClick={() => void load()}
            disabled={loading}
            className="border border-border bg-panel px-1.5 py-0.5 text-zinc-400 hover:border-accent hover:text-accent"
            title="Refresh news"
          >
            <RefreshCw size={10} className={`inline ${loading ? "animate-spin" : ""}`} />
          </button>
        </span>
      </div>

      {error ? (
        <div className="px-2 py-2 text-2xs uppercase text-neg">{error}</div>
      ) : items.length === 0 && !loading ? (
        <div className="px-2 py-3 text-center text-2xs uppercase text-zinc-600">
          no headlines in last 7d{filter ? ` · ${filter}` : ""}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <NewsRow key={it.id} item={it} />
          ))}
        </ul>
      )}
    </section>
  );
}

function NewsRow({ item }: { item: NewsItem }) {
  const ts = item.publishedAt || item.createdAt;
  return (
    <li>
      <a
        href={item.url ?? "#"}
        target="_blank"
        rel="noreferrer"
        className="flex items-start gap-2 px-2 py-1.5 hover:bg-black/40"
      >
        <span className="shrink-0 text-2xs font-bold uppercase tracking-widest text-accent" style={{ minWidth: "4.5rem" }}>
          {item.source.slice(0, 9)}
        </span>
        <span className="flex-1 truncate text-xs text-zinc-100">{item.title}</span>
        <span className="shrink-0 text-2xs uppercase tracking-widest text-zinc-600">
          {relTime(ts)}
        </span>
        {item.url && <ExternalLink size={11} className="shrink-0 text-zinc-600" />}
      </a>
    </li>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`border px-1.5 py-0.5 text-2xs uppercase tracking-widest transition ${
        active
          ? "border-accent bg-accent/15 text-accent"
          : "border-border text-zinc-500 hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const m = Math.floor(d / 30);
  return `${m}mo`;
}
