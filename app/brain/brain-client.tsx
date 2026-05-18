"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Sparkles,
  RefreshCw,
  Trash2,
  AlertTriangle,
  X,
  ExternalLink,
  Filter,
  ChevronLeft,
  ChevronRight,
  Library,
  BarChart3,
  Wrench,
  CheckCircle2,
} from "lucide-react";

type Tab = "search" | "library" | "analytics" | "admin";

type SourceType =
  | "news"
  | "rss"
  | "pdf"
  | "manual"
  | "sim_output"
  | "market_note"
  | "transcript";

const SOURCES: SourceType[] = [
  "rss",
  "news",
  "pdf",
  "manual",
  "market_note",
  "transcript",
  "sim_output",
];

export function BrainClient() {
  const [tab, setTab] = useState<Tab>("search");
  const [drawerId, setDrawerId] = useState<string | null>(null);

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-1 border-b border-border pb-1">
        <TabButton active={tab === "search"} onClick={() => setTab("search")} icon={<Search size={11} />}>
          SEARCH
        </TabButton>
        <TabButton active={tab === "library"} onClick={() => setTab("library")} icon={<Library size={11} />}>
          LIBRARY
        </TabButton>
        <TabButton active={tab === "analytics"} onClick={() => setTab("analytics")} icon={<BarChart3 size={11} />}>
          ANALYTICS
        </TabButton>
        <TabButton active={tab === "admin"} onClick={() => setTab("admin")} icon={<Wrench size={11} />}>
          ADMIN
        </TabButton>
      </div>

      <div className="mt-2">
        {tab === "search" && <SearchPanel onOpenDoc={setDrawerId} />}
        {tab === "library" && <LibraryPanel onOpenDoc={setDrawerId} />}
        {tab === "analytics" && <AnalyticsPanel />}
        {tab === "admin" && <AdminPanel />}
      </div>

      {drawerId && (
        <DocDrawer id={drawerId} onClose={() => setDrawerId(null)} />
      )}
    </>
  );
}

/* ========= Tabs chrome ========= */

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 border px-2 py-0.5 text-2xs uppercase tracking-widest transition ${
        active
          ? "border-accent bg-accent text-bg"
          : "border-border text-zinc-500 hover:text-accent"
      }`}
    >
      {icon}
      {children}
    </button>
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
        <span className="text-2xs font-medium uppercase tracking-widest text-zinc-300">{title}</span>
        {right && <span className="ml-auto">{right}</span>}
      </div>
      <div className="px-2 py-2">{children}</div>
    </section>
  );
}

/* ========= SEARCH ========= */

interface Chunk {
  id: string;
  documentId: string;
  content: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}
interface Citation {
  index: number;
  chunkId: string;
  documentId: string;
  similarity: number;
  excerpt: string;
}

function SearchPanel({ onOpenDoc }: { onOpenDoc: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [source, setSource] = useState<"" | SourceType>("");
  const [minSim, setMinSim] = useState(0.3);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [answer, setAnswer] = useState<string>("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [busy, setBusy] = useState<"" | "search" | "ask">("");
  const [error, setError] = useState<string>("");

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy("search");
    setError("");
    setAnswer("");
    setCitations([]);
    try {
      const res = await fetch("/api/brain/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          matchCount: 12,
          minSimilarity: minSim,
          filterSource: source || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "failed");
      setChunks(j.chunks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown");
    } finally {
      setBusy("");
    }
  }

  async function runAsk() {
    if (!q.trim()) return;
    setBusy("ask");
    setError("");
    try {
      const res = await fetch("/api/brain/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          matchCount: 8,
          minSimilarity: minSim,
          filterSource: source || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "failed");
      setAnswer(j.answer ?? "");
      setCitations(j.citations ?? []);
      setChunks(j.chunks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown");
    } finally {
      setBusy("");
    }
  }

  // Render the answer with [N] tokens replaced by clickable spans.
  const answerNodes = useMemo(() => renderCitations(answer, citations), [answer, citations]);

  return (
    <Section code="S1" title="SEMANTIC SEARCH">
      <form onSubmit={runSearch} className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask the brain — e.g. ECB July guidance, US recession signals, oil supply shock..."
          className="input-field flex-1 font-mono"
          required
          autoFocus
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as "" | SourceType)}
          className="input-field w-full lg:w-32"
        >
          <option value="">all sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-1 text-2xs uppercase tracking-widest text-zinc-500">
          MIN SIM
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={minSim}
            onChange={(e) => setMinSim(Math.min(1, Math.max(0, Number(e.target.value) || 0)))}
            className="input-field w-16"
          />
        </label>
        <button type="submit" disabled={!q.trim() || busy !== ""} className="btn-secondary">
          <Search size={11} /> {busy === "search" ? "…" : "SEARCH"}
        </button>
        <button
          type="button"
          onClick={runAsk}
          disabled={!q.trim() || busy !== ""}
          className="btn-primary"
        >
          <Sparkles size={11} /> {busy === "ask" ? "THINKING…" : "ASK AI"}
        </button>
      </form>

      {error && (
        <div className="mt-2 border border-neg/60 bg-neg/10 px-2 py-1 text-2xs uppercase text-neg">
          {error}
        </div>
      )}

      {answer && (
        <div className="mt-3 border border-accent/40 bg-accent/5 px-3 py-2">
          <div className="flex items-center gap-2 text-2xs uppercase tracking-widest text-accent">
            <Sparkles size={11} /> ANSWER
          </div>
          <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
            {answerNodes}
          </div>
          {citations.length > 0 && (
            <div className="mt-2 grid grid-cols-1 gap-1 border-t border-accent/30 pt-2 md:grid-cols-2">
              {citations.map((c) => (
                <button
                  key={`cit-${c.index}`}
                  id={`cit-${c.index}`}
                  onClick={() => onOpenDoc(c.documentId)}
                  className="flex w-full items-start gap-2 border border-border bg-black/30 px-2 py-1 text-left hover:border-accent"
                >
                  <span className="font-mono text-2xs font-bold uppercase tracking-widest text-accent">
                    [{c.index}]
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-2xs text-zinc-300">{c.excerpt}…</div>
                    <div className="text-2xs uppercase tracking-widest text-zinc-600">
                      sim {c.similarity.toFixed(3)}
                    </div>
                  </div>
                  <ExternalLink size={11} className="shrink-0 text-zinc-500" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {chunks.length > 0 && !answer && (
        <div className="mt-3 space-y-1">
          <div className="text-2xs uppercase tracking-widest text-zinc-500">
            {chunks.length} CHUNKS
          </div>
          {chunks.map((c) => (
            <button
              key={c.id}
              onClick={() => onOpenDoc(c.documentId)}
              className="flex w-full items-start gap-2 border border-border bg-black/30 px-2 py-2 text-left hover:border-accent"
            >
              <span className="font-mono text-2xs font-bold uppercase tracking-widest text-accent">
                {c.similarity.toFixed(3)}
              </span>
              <span className="flex-1 text-2xs text-zinc-200">
                {c.content.slice(0, 360)}
                {c.content.length > 360 && "…"}
              </span>
              <ExternalLink size={11} className="shrink-0 text-zinc-500" />
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}

function renderCitations(text: string, citations: Citation[]): React.ReactNode {
  if (!text) return null;
  const valid = new Set(citations.map((c) => c.index));
  // Split on tokens like [1], [12]; keep delimiters via capturing group.
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((p, i) => {
    const m = p.match(/^\[(\d+)\]$/);
    if (m && valid.has(Number(m[1]))) {
      const n = Number(m[1]);
      return (
        <a
          key={i}
          href={`#cit-${n}`}
          className="mx-0.5 inline-block rounded-sm bg-accent/20 px-1 font-mono text-2xs font-bold text-accent hover:bg-accent/40"
        >
          [{n}]
        </a>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

/* ========= LIBRARY ========= */

interface DocRow {
  id: string;
  title: string;
  source_type: SourceType;
  source_url: string | null;
  author: string | null;
  published_at: string | null;
  created_at: string;
}

interface DocsResponse {
  docs: DocRow[];
  total: number;
  cursor: number;
  nextCursor: number | null;
  pageSize: number;
}

function LibraryPanel({ onOpenDoc }: { onOpenDoc: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [source, setSource] = useState<"" | SourceType>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cursor, setCursor] = useState(0);
  const [data, setData] = useState<DocsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (source) params.set("source", source);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("cursor", String(cursor));
      const res = await fetch(`/api/brain/docs?${params.toString()}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "failed");
      setData(j as DocsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown");
    } finally {
      setLoading(false);
    }
  }, [q, source, from, to, cursor]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters() {
    setCursor(0);
    void load();
  }
  function clearFilters() {
    setQ("");
    setSource("");
    setFrom("");
    setTo("");
    setCursor(0);
  }

  return (
    <Section
      code="L1"
      title="DOCUMENT LIBRARY"
      right={
        <span className="text-2xs uppercase tracking-widest text-zinc-500">
          {data ? `${data.total} TOTAL` : ""}
        </span>
      }
    >
      <div className="flex flex-wrap items-end gap-2 border-b border-border pb-2">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-2xs uppercase tracking-widest text-zinc-500 mb-0.5">
            TITLE CONTAINS
          </label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="keyword"
            className="input-field w-full"
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </div>
        <div>
          <label className="block text-2xs uppercase tracking-widest text-zinc-500 mb-0.5">
            SOURCE
          </label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as "" | SourceType)}
            className="input-field w-32"
          >
            <option value="">all</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-2xs uppercase tracking-widest text-zinc-500 mb-0.5">
            FROM
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="input-field w-36"
          />
        </div>
        <div>
          <label className="block text-2xs uppercase tracking-widest text-zinc-500 mb-0.5">
            TO
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input-field w-36"
          />
        </div>
        <button onClick={applyFilters} className="btn-secondary">
          <Filter size={11} /> APPLY
        </button>
        <button onClick={clearFilters} className="btn-secondary">
          CLEAR
        </button>
      </div>

      {error && (
        <div className="mt-2 border border-neg/60 bg-neg/10 px-2 py-1 text-2xs uppercase text-neg">
          {error}
        </div>
      )}

      <div className="mt-2 overflow-x-auto">
        <table className="w-full font-mono text-2xs tabular-nums">
          <thead>
            <tr className="border-b border-border text-left uppercase tracking-widest text-zinc-500">
              <th className="px-2 py-1">TIME</th>
              <th className="px-2 py-1">SOURCE</th>
              <th className="px-2 py-1">TITLE</th>
              <th className="px-2 py-1 text-right">URL</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr>
                <td colSpan={4} className="px-2 py-3 text-center text-2xs uppercase text-zinc-600">
                  <RefreshCw size={11} className="inline animate-spin" /> LOADING
                </td>
              </tr>
            ) : (data?.docs ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-2 py-3 text-center text-2xs uppercase text-zinc-600">
                  NO DOCUMENTS
                </td>
              </tr>
            ) : (
              data!.docs.map((d) => (
                <tr
                  key={d.id}
                  className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-black/40"
                  onClick={() => onOpenDoc(d.id)}
                >
                  <td className="px-2 py-1 text-zinc-500">
                    {new Date(d.created_at).toLocaleString(undefined, {
                      year: "2-digit",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-2 py-1 text-accent">{d.source_type}</td>
                  <td className="px-2 py-1 text-zinc-200">{d.title}</td>
                  <td className="px-2 py-1 text-right text-zinc-500">
                    {d.source_url ? (
                      <a
                        href={d.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-accent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={11} className="inline" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > data.pageSize && (
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <span className="text-2xs uppercase tracking-widest text-zinc-500">
            {cursor + 1}–{Math.min(cursor + data.pageSize, data.total)} / {data.total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCursor(Math.max(0, cursor - data.pageSize))}
              disabled={cursor === 0}
              className="btn-secondary disabled:opacity-30"
            >
              <ChevronLeft size={11} /> PREV
            </button>
            <button
              onClick={() => data.nextCursor != null && setCursor(data.nextCursor)}
              disabled={data.nextCursor == null}
              className="btn-secondary disabled:opacity-30"
            >
              NEXT <ChevronRight size={11} />
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ========= ANALYTICS ========= */

interface BrainStats {
  totals: {
    docs: number;
    chunks: number;
    sources: number;
    chunksWithEmbedding: number;
    chunksWithoutEmbedding: number;
  };
  bySource: Array<{ source: string; count: number }>;
  ingestTimeline: Array<{ date: string; count: number }>;
  recent: Array<{
    id: string;
    title: string;
    source_type: string;
    source_url: string | null;
    created_at: string;
  }>;
  quality: {
    avgChunksPerDoc: number;
    embeddingDim: number;
    embeddingModel: string;
  };
}

function useStats(): { stats: BrainStats | null; reload: () => Promise<void>; loading: boolean; error: string } {
  const [stats, setStats] = useState<BrainStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/brain/stats");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "failed");
      setStats(j as BrainStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { stats, reload, loading, error };
}

function AnalyticsPanel() {
  const { stats, loading, error } = useStats();

  return (
    <>
      <Section code="A1" title="TOTALS">
        {error && (
          <div className="mb-2 border border-neg/60 bg-neg/10 px-2 py-1 text-2xs uppercase text-neg">
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          <Stat label="DOCS" value={stats?.totals.docs ?? (loading ? "…" : 0)} />
          <Stat label="CHUNKS" value={stats?.totals.chunks ?? (loading ? "…" : 0)} />
          <Stat label="SOURCES" value={stats?.totals.sources ?? (loading ? "…" : 0)} />
          <Stat
            label="AVG CHUNKS/DOC"
            value={stats?.quality.avgChunksPerDoc ?? (loading ? "…" : 0)}
          />
          <Stat label="DIM" value={stats?.quality.embeddingDim ?? "—"} />
        </div>
      </Section>

      <Section code="A2" title="INGEST RATE · 30D">
        {stats ? <IngestSpark points={stats.ingestTimeline} /> : <Skeleton />}
      </Section>

      <Section code="A3" title="SOURCE BREAKDOWN">
        {stats ? <SourceBars rows={stats.bySource} /> : <Skeleton />}
      </Section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-border bg-black/30 px-2 py-1">
      <div className="text-2xs uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="font-mono text-lg tabular-nums text-accent">{value}</div>
    </div>
  );
}

function Skeleton() {
  return <div className="h-24 animate-pulse border border-border bg-black/30" />;
}

function IngestSpark({ points }: { points: Array<{ date: string; count: number }> }) {
  if (points.length < 2) {
    return <div className="text-2xs uppercase text-zinc-600">no history</div>;
  }
  const W = 600;
  const H = 100;
  const max = Math.max(...points.map((p) => p.count), 1);
  const bw = (W - 4) / points.length;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: H }}>
        <line x1={0} x2={W} y1={H - 2} y2={H - 2} stroke="#262629" />
        {points.map((p, i) => {
          const h = max === 0 ? 0 : (p.count / max) * (H - 12);
          return (
            <g key={p.date}>
              <rect
                x={2 + i * bw}
                y={H - 2 - h}
                width={Math.max(1, bw - 1)}
                height={h}
                fill="#f5a623"
                opacity={0.75}
              />
            </g>
          );
        })}
        <text x={4} y={10} fontSize={8} fill="#6b6b72">
          max {max}/day
        </text>
        <text x={W - 4} y={10} fontSize={8} fill="#6b6b72" textAnchor="end">
          {points[0].date} → {points[points.length - 1].date}
        </text>
      </svg>
      <div className="mt-1 text-2xs uppercase tracking-widest text-zinc-500">
        TOTAL 30D: {points.reduce((s, p) => s + p.count, 0)} DOCS
      </div>
    </div>
  );
}

function SourceBars({ rows }: { rows: Array<{ source: string; count: number }> }) {
  if (rows.length === 0) return <div className="text-2xs uppercase text-zinc-600">no sources</div>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="space-y-1">
      {rows.map((r) => {
        const pct = (r.count / max) * 100;
        return (
          <div key={r.source} className="flex items-center gap-2">
            <div className="w-24 truncate text-2xs uppercase tracking-widest text-zinc-300">
              {r.source}
            </div>
            <div className="relative flex-1 overflow-hidden border border-border bg-black/40">
              <div className="h-3 bg-accent/60" style={{ width: `${pct}%` }} />
            </div>
            <div className="w-12 text-right font-mono text-2xs tabular-nums text-zinc-300">
              {r.count}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ========= ADMIN ========= */

interface DedupeResp {
  ok: boolean;
  applied: boolean;
  duplicateGroupCount: number;
  duplicateDocCount: number;
  sampleGroups: Array<{
    key: string;
    keeper: { id: string; title: string; created_at: string };
    duplicates: Array<{ id: string; title: string; created_at: string }>;
  }>;
}

interface ReembedResp {
  ok: boolean;
  remaining: number;
  processed: number;
  failed: number;
  durationMs: number;
  nextCall?: "yes" | "no";
}

function AdminPanel() {
  const { stats, reload, error: statsError } = useStats();

  const [dedupe, setDedupe] = useState<DedupeResp | null>(null);
  const [dedupeBusy, setDedupeBusy] = useState<"" | "dry" | "apply">("");
  const [dedupeError, setDedupeError] = useState("");

  const [reembedRuns, setReembedRuns] = useState<ReembedResp[]>([]);
  const [reembedBusy, setReembedBusy] = useState(false);
  const [reembedError, setReembedError] = useState("");

  async function runDedupe(apply: boolean) {
    setDedupeBusy(apply ? "apply" : "dry");
    setDedupeError("");
    try {
      const res = await fetch("/api/brain/admin/dedupe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "failed");
      setDedupe(j as DedupeResp);
      if (apply) await reload();
    } catch (err) {
      setDedupeError(err instanceof Error ? err.message : "unknown");
    } finally {
      setDedupeBusy("");
    }
  }

  async function runReembed() {
    setReembedBusy(true);
    setReembedError("");
    setReembedRuns([]);
    try {
      let done = false;
      let iter = 0;
      const runs: ReembedResp[] = [];
      while (!done && iter < 50) {
        iter += 1;
        const res = await fetch("/api/brain/admin/reembed", { method: "POST" });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "failed");
        const run = j as ReembedResp;
        runs.push(run);
        setReembedRuns([...runs]);
        if (run.nextCall === "no" || run.processed === 0) done = true;
      }
      await reload();
    } catch (err) {
      setReembedError(err instanceof Error ? err.message : "unknown");
    } finally {
      setReembedBusy(false);
    }
  }

  const coverage =
    stats && stats.totals.chunks > 0
      ? Math.round((stats.totals.chunksWithEmbedding / stats.totals.chunks) * 1000) / 10
      : 100;

  return (
    <>
      <Section code="Q1" title="EMBEDDING QUALITY">
        {statsError && (
          <div className="mb-2 border border-neg/60 bg-neg/10 px-2 py-1 text-2xs uppercase text-neg">
            {statsError}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          <Stat label="COVERAGE" value={`${coverage}%`} />
          <Stat label="WITH EMBEDDING" value={stats?.totals.chunksWithEmbedding ?? "…"} />
          <Stat label="PENDING" value={stats?.totals.chunksWithoutEmbedding ?? "…"} />
          <Stat label="MODEL" value={stats?.quality.embeddingModel ?? "…"} />
          <Stat label="DIM" value={stats?.quality.embeddingDim ?? "…"} />
        </div>
        {stats && stats.totals.chunks > 0 && (
          <div className="mt-2 h-2 w-full overflow-hidden bg-black">
            <div
              className="h-full bg-pos"
              style={{ width: `${coverage}%` }}
            />
          </div>
        )}
      </Section>

      <Section code="R1" title="RE-EMBED PENDING CHUNKS">
        <p className="text-2xs uppercase tracking-widest text-zinc-500">
          Generates embeddings for chunks that have <code className="text-accent">embedding IS NULL</code>{" "}
          using the current model. Loops in 80-chunk batches until the queue is empty.
        </p>
        <button
          onClick={runReembed}
          disabled={reembedBusy}
          className="btn-primary mt-2"
        >
          <RefreshCw size={11} className={reembedBusy ? "animate-spin" : ""} />{" "}
          {reembedBusy ? "RUNNING…" : "RUN"}
        </button>
        {reembedError && (
          <div className="mt-2 border border-neg/60 bg-neg/10 px-2 py-1 text-2xs uppercase text-neg">
            {reembedError}
          </div>
        )}
        {reembedRuns.length > 0 && (
          <table className="mt-2 w-full font-mono text-2xs tabular-nums">
            <thead>
              <tr className="border-b border-border text-left uppercase tracking-widest text-zinc-500">
                <th className="px-2 py-1">RUN</th>
                <th className="px-2 py-1 text-right">PROCESSED</th>
                <th className="px-2 py-1 text-right">FAILED</th>
                <th className="px-2 py-1 text-right">REMAINING</th>
                <th className="px-2 py-1 text-right">DURATION</th>
              </tr>
            </thead>
            <tbody>
              {reembedRuns.map((r, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="px-2 py-1 text-accent">#{i + 1}</td>
                  <td className="px-2 py-1 text-right text-pos">{r.processed}</td>
                  <td className="px-2 py-1 text-right text-neg">{r.failed}</td>
                  <td className="px-2 py-1 text-right text-zinc-300">{r.remaining}</td>
                  <td className="px-2 py-1 text-right text-zinc-500">{r.durationMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section code="D1" title="DEDUPLICATE BY SOURCE URL">
        <p className="text-2xs uppercase tracking-widest text-zinc-500">
          Groups docs by normalized <code className="text-accent">source_url</code> (host + path).
          Oldest doc stays, the rest are removed (chunks cascade-deleted).
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => runDedupe(false)} disabled={dedupeBusy !== ""} className="btn-secondary">
            <AlertTriangle size={11} /> DRY RUN
          </button>
          <button
            onClick={() => runDedupe(true)}
            disabled={dedupeBusy !== "" || !dedupe || dedupe.duplicateDocCount === 0}
            className="btn-primary"
          >
            <Trash2 size={11} /> {dedupeBusy === "apply" ? "DELETING…" : "DELETE DUPLICATES"}
          </button>
        </div>
        {dedupeError && (
          <div className="mt-2 border border-neg/60 bg-neg/10 px-2 py-1 text-2xs uppercase text-neg">
            {dedupeError}
          </div>
        )}
        {dedupe && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2 text-2xs uppercase tracking-widest">
              {dedupe.applied ? (
                <span className="flex items-center gap-1 text-pos">
                  <CheckCircle2 size={11} /> APPLIED · {dedupe.duplicateDocCount} DOCS REMOVED
                </span>
              ) : (
                <span className="text-zinc-300">
                  {dedupe.duplicateGroupCount} GROUPS · {dedupe.duplicateDocCount} DUPLICATES
                </span>
              )}
            </div>
            {dedupe.sampleGroups.length > 0 && (
              <ul className="divide-y divide-border border border-border bg-black/30">
                {dedupe.sampleGroups.map((g) => (
                  <li key={g.key} className="px-2 py-1">
                    <div className="truncate text-2xs uppercase text-zinc-500">{g.key}</div>
                    <div className="text-xs text-pos">keep · {g.keeper.title}</div>
                    {g.duplicates.map((d) => (
                      <div key={d.id} className="text-xs text-neg/80">
                        − {d.title}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>
    </>
  );
}

/* ========= DRAWER ========= */

interface DocDetail {
  doc: {
    id: string;
    title: string;
    source_type: SourceType;
    source_url: string | null;
    author: string | null;
    published_at: string | null;
    raw_text: string;
    metadata: Record<string, unknown>;
    created_at: string;
  };
  chunks: Array<{
    id: string;
    chunkIndex: number;
    content: string;
    tokenCount: number | null;
    hasEmbedding: boolean;
  }>;
}

function DocDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<DocDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/brain/docs/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error) setError(j.error);
        else setData(j as DocDetail);
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function remove() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/brain/docs/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "failed");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown");
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col border-l border-border bg-bg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border bg-black/40 px-3 py-2">
          <span className="text-2xs font-bold uppercase tracking-widest text-accent">DOC</span>
          <span className="truncate text-2xs uppercase tracking-widest text-zinc-300">
            {data?.doc.title ?? (loading ? "loading…" : id.slice(0, 8))}
          </span>
          <button
            onClick={onClose}
            className="ml-auto border border-border bg-panel px-1.5 py-0.5 text-2xs uppercase tracking-widest text-zinc-300 hover:border-accent hover:text-accent"
          >
            <X size={11} className="inline" /> CLOSE
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {error && (
            <div className="mb-2 border border-neg/60 bg-neg/10 px-2 py-1 text-2xs uppercase text-neg">
              {error}
            </div>
          )}
          {loading && !data && (
            <div className="text-2xs uppercase text-zinc-500">LOADING…</div>
          )}
          {data && (
            <>
              <h2 className="text-lg font-semibold text-zinc-100">{data.doc.title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-2xs uppercase tracking-widest text-zinc-500">
                <span className="text-accent">{data.doc.source_type}</span>
                <span>·</span>
                <span>{new Date(data.doc.created_at).toLocaleString()}</span>
                {data.doc.author && (
                  <>
                    <span>·</span>
                    <span>{data.doc.author}</span>
                  </>
                )}
                {data.doc.source_url && (
                  <>
                    <span>·</span>
                    <a
                      href={data.doc.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline"
                    >
                      OPEN SOURCE ↗
                    </a>
                  </>
                )}
              </div>

              <div className="mt-3 border border-border bg-panel">
                <div className="flex items-center gap-2 border-b border-border bg-black/40 px-2 py-1">
                  <span className="text-2xs font-bold uppercase tracking-widest text-accent">C</span>
                  <span className="text-2xs uppercase tracking-widest text-zinc-300">
                    {data.chunks.length} CHUNKS
                  </span>
                  <span className="ml-auto text-2xs uppercase tracking-widest text-zinc-500">
                    {data.chunks.filter((c) => c.hasEmbedding).length}/{data.chunks.length} EMBEDDED
                  </span>
                </div>
                <ul className="divide-y divide-border">
                  {data.chunks.map((c) => (
                    <li key={c.id} className="px-2 py-1">
                      <div className="flex items-center gap-2 text-2xs uppercase tracking-widest text-zinc-500">
                        <span className="text-accent">#{c.chunkIndex}</span>
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${
                            c.hasEmbedding ? "bg-pos" : "bg-neg"
                          }`}
                          title={c.hasEmbedding ? "embedded" : "missing embedding"}
                        />
                        {c.tokenCount != null && <span>{c.tokenCount} tok</span>}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-200">{c.content}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 border-t border-border pt-2">
                <div className="text-2xs uppercase tracking-widest text-zinc-500">DANGER ZONE</div>
                {!confirmDel ? (
                  <button
                    onClick={() => setConfirmDel(true)}
                    className="mt-2 inline-flex items-center gap-1 border border-neg/60 bg-neg/10 px-2 py-1 text-2xs uppercase tracking-widest text-neg hover:bg-neg/20"
                  >
                    <Trash2 size={11} /> DELETE DOCUMENT
                  </button>
                ) : (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-2xs uppercase tracking-widest text-neg">
                      DELETE {data.chunks.length} CHUNKS WITH IT?
                    </span>
                    <button
                      onClick={remove}
                      disabled={deleting}
                      className="border border-neg bg-neg/20 px-2 py-0.5 text-2xs uppercase tracking-widest text-neg hover:bg-neg/30"
                    >
                      {deleting ? "…" : "YES"}
                    </button>
                    <button
                      onClick={() => setConfirmDel(false)}
                      className="border border-border bg-panel px-2 py-0.5 text-2xs uppercase tracking-widest text-zinc-400 hover:text-accent"
                    >
                      CANCEL
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
