"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

type Node = {
  id: string;
  label: string;
  source: string;
  cluster: number;
  val: number;
  url: string | null;
  createdAt: string;
};
type Link = { source: string | Node; target: string | Node; value: number };
type Cluster = { id: number; label: string; topics: string[]; size: number };
type GraphData = { nodes: Node[]; links: Link[]; clusters: Cluster[] };

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

// Carefully chosen palette: bright on dark, distinct hues, no near-duplicates.
const CLUSTER_PALETTE = [
  "#5aa8ff", // azure
  "#d4af37", // gold
  "#3fb98f", // mint
  "#ff7a59", // coral
  "#9b6dff", // violet
  "#e83e8c", // magenta
  "#f7d046", // lemon
  "#6dd3ff", // sky
];

function colorFor(cluster: number): string {
  return CLUSTER_PALETTE[cluster % CLUSTER_PALETTE.length];
}

function getId(endpoint: string | Node): string {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

export function GraphView() {
  const [data, setData] = useState<GraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Node | null>(null);
  const [hiddenClusters, setHiddenClusters] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

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

  // Index nodes by id so linkColor/linkWidth can resolve endpoints when
  // d3-force has not yet replaced source/target string ids with node objects.
  const nodeById = useMemo(() => {
    const m = new Map<string, Node>();
    for (const n of filtered?.nodes ?? []) m.set(n.id, n);
    return m;
  }, [filtered]);

  function resolve(endpoint: string | Node | undefined): Node | undefined {
    if (!endpoint) return undefined;
    if (typeof endpoint === "string") return nodeById.get(endpoint);
    return endpoint;
  }

  function toggleCluster(id: number) {
    setHiddenClusters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div ref={containerRef} className="relative h-full w-full bg-bg">
      {error && (
        <div className="absolute left-4 top-4 z-10 max-w-sm rounded border border-red-900 bg-red-950/70 p-3 text-sm text-red-300">
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
          nodeColor={(n) => colorFor((n as Node).cluster)}
          nodeOpacity={0.95}
          nodeResolution={14}
          // Stronger links inside the same cluster → visible groups.
          // d3-force-3d initially passes source/target as id strings; resolve
          // them via nodeById to avoid an undefined cluster and a black line.
          linkColor={(l) => {
            const s = resolve(l.source as string | Node | undefined);
            const t = resolve(l.target as string | Node | undefined);
            if (s && t && s.cluster === t.cluster) {
              return colorFor(s.cluster);
            }
            return "#b8b8c8";
          }}
          linkWidth={(l) => {
            const s = resolve(l.source as string | Node | undefined);
            const t = resolve(l.target as string | Node | undefined);
            const base = ((l as Link).value - 0.35) * 3;
            return s && t && s.cluster === t.cluster
              ? Math.max(0.8, base)
              : Math.max(0.3, base * 0.5);
          }}
          linkOpacity={0.85}
          enableNodeDrag={false}
          onNodeClick={(n) => setSelected(n as Node)}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          warmupTicks={60}
        />
      )}

      {data && data.clusters.length > 0 && (
        <aside className="pointer-events-auto absolute left-3 top-3 max-w-xs rounded-lg border border-border bg-panel/90 p-3 text-xs backdrop-blur">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
            Clusters (click to toggle)
          </div>
          <ul className="space-y-1">
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
      )}

      {selected && (
        <aside className="absolute right-3 top-3 max-h-[75vh] w-80 overflow-auto rounded-lg border border-border bg-panel p-4 text-sm shadow-xl">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h2 className="text-zinc-100">{selected.label}</h2>
            <button
              onClick={() => setSelected(null)}
              className="rounded text-zinc-500 hover:text-zinc-200"
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
