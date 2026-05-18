"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Search as SearchIcon, X } from "lucide-react";

type Node = {
  id: string;
  label: string;
  source: string;
  cluster: number;
  val: number;
  url: string | null;
  createdAt: string;
  // Three-force-graph injects x/y/z on tick; type as optional.
  x?: number;
  y?: number;
  z?: number;
};
type Link = { source: string | Node; target: string | Node; value: number };
type Cluster = { id: number; label: string; topics: string[]; size: number };
type GraphData = { nodes: Node[]; links: Link[]; clusters: Cluster[] };

interface Citation {
  index: number;
  chunkId: string;
  documentId: string;
  similarity: number;
  excerpt: string;
}
interface AskResponse {
  ok: boolean;
  answer: string;
  citations: Citation[];
  chunks: Array<{ id: string; documentId: string; similarity: number; content: string }>;
  error?: string;
}

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

const CLUSTER_PALETTE = [
  "#5aa8ff",
  "#d4af37",
  "#3fb98f",
  "#ff7a59",
  "#9b6dff",
  "#e83e8c",
  "#f7d046",
  "#6dd3ff",
];

function colorFor(cluster: number): string {
  return CLUSTER_PALETTE[cluster % CLUSTER_PALETTE.length];
}

function getId(endpoint: string | Node): string {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

// react-force-graph exposes imperative methods (cameraPosition, ...) on the
// instance via the React ref. Type as a thin interface so we don't pull the
// full lib types in just for one method.
interface FgInstance {
  cameraPosition: (
    pos: { x: number; y: number; z: number },
    lookAt?: { x: number; y: number; z: number },
    ms?: number,
  ) => void;
}

export function GraphView() {
  const [data, setData] = useState<GraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Node | null>(null);
  const [hiddenClusters, setHiddenClusters] = useState<Set<number>>(new Set());
  const [legendOpen, setLegendOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<FgInstance | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  // Ask-AI overlay state
  const [askQuery, setAskQuery] = useState("");
  const [askBusy, setAskBusy] = useState<"" | "search" | "ask">("");
  const [askAnswer, setAskAnswer] = useState("");
  const [askCitations, setAskCitations] = useState<Citation[]>([]);
  const [askError, setAskError] = useState("");
  const [askOpen, setAskOpen] = useState(true);
  const highlightedIds = useMemo(
    () => new Set(askCitations.map((c) => c.documentId)),
    [askCitations],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/brain/graph?limit=400")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error) setError(j.error);
        else
          setData({
            nodes: j.nodes ?? [],
            links: j.links ?? [],
            clusters: j.clusters ?? [],
          });
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => {
      const el = containerRef.current!;
      setDims({ w: el.clientWidth, h: el.clientHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const filtered = useMemo<GraphData | null>(() => {
    if (!data) return null;
    if (hiddenClusters.size === 0) return data;
    const nodes = data.nodes.filter((n) => !hiddenClusters.has(n.cluster));
    const allowed = new Set(nodes.map((n) => n.id));
    const links = data.links.filter(
      (l) => allowed.has(getId(l.source)) && allowed.has(getId(l.target)),
    );
    return { nodes, links, clusters: data.clusters };
  }, [data, hiddenClusters]);

  const clusterById = useMemo(() => {
    const m = new Map<number, Cluster>();
    for (const c of data?.clusters ?? []) m.set(c.id, c);
    return m;
  }, [data]);

  const nodeById = useMemo(() => {
    const m = new Map<string, Node>();
    for (const n of filtered?.nodes ?? []) m.set(n.id, n);
    return m;
  }, [filtered]);

  const resolve = useCallback(
    (endpoint: string | Node | undefined): Node | undefined => {
      if (!endpoint) return undefined;
      if (typeof endpoint === "string") return nodeById.get(endpoint);
      return endpoint;
    },
    [nodeById],
  );

  function toggleCluster(id: number) {
    setHiddenClusters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function focusNode(node: Node) {
    setSelected(node);
    const fg = fgRef.current;
    if (!fg || node.x == null || node.y == null || node.z == null) return;
    const distance = 120;
    const dist = Math.hypot(node.x, node.y, node.z) || 1;
    const ratio = 1 + distance / dist;
    fg.cameraPosition(
      { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
      { x: node.x, y: node.y, z: node.z },
      1200,
    );
  }

  // Ask AI: retrieves chunks, optionally calls LLM, then highlights the
  // documents the answer cited.
  async function runAsk(mode: "search" | "ask", e?: React.FormEvent) {
    e?.preventDefault();
    if (!askQuery.trim()) return;
    setAskBusy(mode);
    setAskError("");
    setAskAnswer("");
    try {
      const endpoint = mode === "ask" ? "/api/brain/ask" : "/api/brain/query";
      const body =
        mode === "ask"
          ? { query: askQuery, matchCount: 8, minSimilarity: 0.3 }
          : { query: askQuery, matchCount: 12, minSimilarity: 0.3 };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as AskResponse & {
        chunks?: Array<{ documentId: string; content: string; similarity: number; id: string }>;
      };
      if (!res.ok) throw new Error(j.error || "failed");

      if (mode === "ask") {
        setAskAnswer(j.answer ?? "");
        setAskCitations(j.citations ?? []);
      } else {
        setAskAnswer("");
        // Synthesize "citations" from raw chunks so the highlight machinery
        // works the same way as for Ask AI.
        const cits: Citation[] = (j.chunks ?? []).map((c, i) => ({
          index: i + 1,
          chunkId: c.id,
          documentId: c.documentId,
          similarity: c.similarity,
          excerpt: c.content.slice(0, 220),
        }));
        setAskCitations(cits);
      }
    } catch (err) {
      setAskError(err instanceof Error ? err.message : "unknown");
    } finally {
      setAskBusy("");
    }
  }

  function clearAsk() {
    setAskQuery("");
    setAskAnswer("");
    setAskCitations([]);
    setAskError("");
  }

  const answerNodes = useMemo(
    () => renderCitations(askAnswer, askCitations, (docId) => {
      const node = nodeById.get(docId);
      if (node) focusNode(node);
    }),
    [askAnswer, askCitations, nodeById],
  );

  const hasHighlight = highlightedIds.size > 0;

  return (
    <div ref={containerRef} className="relative h-full w-full bg-bg">
      {error && (
        <div className="absolute left-4 top-20 z-10 max-w-sm rounded border border-red-900 bg-red-950/70 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {data && data.nodes.length === 0 && (
        <div className="flex h-full items-center justify-center text-zinc-500">
          Il Brain è vuoto. Aspetta il cron RSS o chiama <code className="ml-1">/api/seed</code>.
        </div>
      )}

      {!data && !error && (
        <div className="flex h-full items-center justify-center text-zinc-500">
          Caricamento + clustering semantico…
        </div>
      )}

      {filtered && filtered.nodes.length > 0 && dims.w > 0 && (
        <ForceGraph3D
          ref={fgRef as never}
          graphData={filtered}
          width={dims.w}
          height={dims.h}
          backgroundColor="#0a0a0b"
          nodeId="id"
          nodeLabel={(n) => {
            const node = n as Node;
            const c = clusterById.get(node.cluster);
            return `<div style="max-width:320px;padding:4px 6px"><b>${escapeHtml(node.label)}</b><br/><span style="color:#888;font-size:11px">${c ? escapeHtml(c.label) : "cluster"} · ${escapeHtml(node.source)}</span></div>`;
          }}
          nodeColor={(n) => {
            const node = n as Node;
            const base = colorFor(node.cluster);
            if (!hasHighlight) return base;
            return highlightedIds.has(node.id) ? base : "#2a2a2f";
          }}
          nodeOpacity={0.95}
          nodeResolution={14}
          nodeVal={(n) => {
            const node = n as Node;
            if (hasHighlight && highlightedIds.has(node.id)) return Math.max(node.val, 4) * 2.2;
            return node.val;
          }}
          linkColor={(l) => {
            const s = resolve(l.source as string | Node | undefined);
            const t = resolve(l.target as string | Node | undefined);
            if (hasHighlight) {
              const onHighlight = s && t && highlightedIds.has(s.id) && highlightedIds.has(t.id);
              if (onHighlight) return s && t && s.cluster === t.cluster ? colorFor(s.cluster) : "#f5a623";
              return "#1a1a1d";
            }
            if (s && t && s.cluster === t.cluster) {
              return colorFor(s.cluster);
            }
            return "#b8b8c8";
          }}
          linkWidth={(l) => {
            const s = resolve(l.source as string | Node | undefined);
            const t = resolve(l.target as string | Node | undefined);
            const base = ((l as Link).value - 0.35) * 3;
            if (hasHighlight && s && t && highlightedIds.has(s.id) && highlightedIds.has(t.id)) {
              return Math.max(1.5, base * 1.5);
            }
            return s && t && s.cluster === t.cluster
              ? Math.max(0.8, base)
              : Math.max(0.3, base * 0.5);
          }}
          linkOpacity={hasHighlight ? 0.5 : 0.85}
          enableNodeDrag={false}
          onNodeClick={(n) => setSelected(n as Node)}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          warmupTicks={60}
        />
      )}

      {/* Top-center AI search bar */}
      <div className="absolute inset-x-3 top-3 z-30 flex justify-center md:inset-x-auto md:left-1/2 md:-translate-x-1/2">
        <div className="w-full max-w-2xl border border-border bg-panel/95 px-2 py-1.5 backdrop-blur">
          <form
            className="flex flex-wrap items-center gap-1.5"
            onSubmit={(e) => runAsk("ask", e)}
          >
            <Sparkles size={12} className="shrink-0 text-accent" />
            <input
              value={askQuery}
              onChange={(e) => setAskQuery(e.target.value)}
              placeholder="Ask the graph — e.g. recent ECB QT signals"
              className="input-field flex-1 min-w-[180px] font-mono text-2xs"
            />
            <button
              type="button"
              onClick={() => runAsk("search")}
              disabled={!askQuery.trim() || askBusy !== ""}
              className="btn-secondary"
              title="Highlight matching docs without an LLM answer"
            >
              <SearchIcon size={11} /> {askBusy === "search" ? "…" : "FIND"}
            </button>
            <button
              type="submit"
              disabled={!askQuery.trim() || askBusy !== ""}
              className="btn-primary"
              title="Retrieve + GPT answer with citations linked to graph nodes"
            >
              <Sparkles size={11} /> {askBusy === "ask" ? "THINKING…" : "ASK"}
            </button>
            {(askCitations.length > 0 || askAnswer || askError) && (
              <button
                type="button"
                onClick={clearAsk}
                className="border border-border bg-panel px-1.5 py-0.5 text-2xs uppercase tracking-widest text-zinc-400 hover:border-accent hover:text-accent"
                title="Clear highlight"
              >
                <X size={11} />
              </button>
            )}
          </form>
          {hasHighlight && (
            <div className="mt-1 flex items-center justify-between text-2xs uppercase tracking-widest text-zinc-500">
              <span>
                {highlightedIds.size} doc{highlightedIds.size === 1 ? "" : "s"} highlighted ·{" "}
                {askCitations.length} chunk{askCitations.length === 1 ? "" : "s"}
              </span>
              <button
                onClick={() => setAskOpen((o) => !o)}
                className="text-accent hover:underline"
              >
                {askOpen ? "hide panel" : "show panel"}
              </button>
            </div>
          )}
          {askError && (
            <div className="mt-1 text-2xs uppercase text-neg">{askError}</div>
          )}
        </div>
      </div>

      {/* Answer + citations panel */}
      {askOpen && (askAnswer || askCitations.length > 0) && (
        <aside className="absolute right-3 top-20 z-20 hidden max-h-[70vh] w-80 overflow-y-auto border border-border bg-panel/95 p-3 text-xs backdrop-blur md:block">
          {askAnswer && (
            <>
              <div className="mb-1 flex items-center gap-1 text-2xs uppercase tracking-widest text-accent">
                <Sparkles size={11} /> ANSWER
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
                {answerNodes}
              </div>
              <div className="my-2 border-t border-border" />
            </>
          )}
          {askCitations.length > 0 && (
            <>
              <div className="mb-1 text-2xs uppercase tracking-widest text-zinc-500">
                CITATIONS ({askCitations.length})
              </div>
              <ul className="space-y-1">
                {askCitations.map((c) => {
                  const node = nodeById.get(c.documentId);
                  return (
                    <li key={`cit-${c.index}`} id={`cit-${c.index}`}>
                      <button
                        onClick={() => node && focusNode(node)}
                        className="flex w-full items-start gap-1 border border-border bg-black/30 px-2 py-1 text-left hover:border-accent"
                      >
                        <span className="font-mono text-2xs font-bold uppercase tracking-widest text-accent">
                          [{c.index}]
                        </span>
                        <div className="min-w-0 flex-1">
                          {node && (
                            <div className="truncate text-2xs text-zinc-200">
                              {node.label}
                            </div>
                          )}
                          <div className="line-clamp-2 text-2xs text-zinc-500">
                            {c.excerpt}…
                          </div>
                          <div className="text-2xs uppercase tracking-widest text-zinc-600">
                            sim {c.similarity.toFixed(3)}
                            {node && (
                              <>
                                {" · "}
                                <span style={{ color: colorFor(node.cluster) }}>
                                  {clusterById.get(node.cluster)?.label ?? "cluster"}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </aside>
      )}

      {data && data.clusters.length > 0 && (
        <>
          <button
            onClick={() => setLegendOpen((v) => !v)}
            className="absolute left-3 top-16 z-20 rounded-md border border-border bg-panel/90 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur md:hidden"
          >
            {legendOpen ? "✕ Close" : `☰ Clusters (${data.clusters.length})`}
          </button>

          <aside
            className={`pointer-events-auto absolute left-3 z-10 max-w-[88vw] rounded-lg border border-border bg-panel/95 p-3 text-xs backdrop-blur transition sm:max-w-xs md:block ${
              legendOpen ? "top-28 block" : "hidden md:top-20"
            } md:top-20`}
          >
            <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
              Clusters (click to toggle)
            </div>
            <ul className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
              {data.clusters.map((c) => {
                const hidden = hiddenClusters.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => toggleCluster(c.id)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left transition hover:bg-zinc-800/60 ${
                        hidden ? "opacity-40" : ""
                      }`}
                    >
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: colorFor(c.id) }}
                      />
                      <span className="flex-1 truncate text-zinc-100">{c.label}</span>
                      <span className="text-zinc-500">{c.size}</span>
                    </button>
                    {c.topics.length > 0 && (
                      <div className="pl-5 text-[10px] text-zinc-500">
                        {c.topics.slice(0, 3).join(" · ")}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 border-t border-border pt-2 text-[10px] text-zinc-500">
              {data.nodes.length} docs · {data.links.length} links
            </div>
          </aside>
        </>
      )}

      {selected && (
        <aside className="absolute inset-x-3 bottom-3 z-20 max-h-[55vh] overflow-auto rounded-lg border border-border bg-panel p-4 text-sm shadow-xl md:inset-x-auto md:bottom-3 md:right-3 md:max-h-[40vh] md:w-80">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h2 className="break-words text-zinc-100">{selected.label}</h2>
            <button
              onClick={() => setSelected(null)}
              className="shrink-0 rounded text-zinc-500 hover:text-zinc-200"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span
              className="rounded px-2 py-0.5"
              style={{
                backgroundColor: `${colorFor(selected.cluster)}22`,
                color: colorFor(selected.cluster),
              }}
            >
              {clusterById.get(selected.cluster)?.label ?? `Cluster ${selected.cluster + 1}`}
            </span>
            <span className="text-zinc-500">{selected.source}</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">{new Date(selected.createdAt).toLocaleString()}</span>
          </div>
          {selected.url && (
            <a
              href={selected.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent hover:underline"
            >
              Open source ↗
            </a>
          )}
        </aside>
      )}
    </div>
  );
}

function renderCitations(
  text: string,
  citations: Citation[],
  onJump: (documentId: string) => void,
): React.ReactNode {
  if (!text) return null;
  const byIdx = new Map(citations.map((c) => [c.index, c]));
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((p, i) => {
    const m = p.match(/^\[(\d+)\]$/);
    if (m) {
      const n = Number(m[1]);
      const cit = byIdx.get(n);
      if (cit) {
        return (
          <button
            key={i}
            onClick={() => onJump(cit.documentId)}
            className="mx-0.5 inline-block rounded-sm bg-accent/20 px-1 font-mono text-2xs font-bold text-accent hover:bg-accent/40"
            title={cit.excerpt}
          >
            [{n}]
          </button>
        );
      }
    }
    return <span key={i}>{p}</span>;
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
