"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

type Node = {
  id: string;
  label: string;
  group: string;
  val: number;
  url: string | null;
  createdAt: string;
};
type Link = { source: string; target: string; value: number };
type GraphData = { nodes: Node[]; links: Link[] };

// 3D renderer must be client-only (uses WebGL + window).
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

const SOURCE_COLORS: Record<string, string> = {
  rss: "#5aa8ff",
  news: "#5aa8ff",
  manual: "#d4af37",
  pdf: "#9b6dff",
  market_note: "#3fb98f",
  sim_output: "#ff7a59",
  transcript: "#b58eff",
  default: "#7a7a82",
};

function colorFor(group: string): string {
  return SOURCE_COLORS[group] ?? SOURCE_COLORS.default;
}

export function GraphView() {
  const [data, setData] = useState<GraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Node | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/brain/graph?limit=400")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error) setError(j.error);
        else setData({ nodes: j.nodes ?? [], links: j.links ?? [] });
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

  const groups = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.nodes.map((n) => n.group));
    return [...set];
  }, [data]);

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
          Caricamento grafo…
        </div>
      )}

      {data && data.nodes.length > 0 && dims.w > 0 && (
        <ForceGraph3D
          graphData={data}
          width={dims.w}
          height={dims.h}
          backgroundColor="#0a0a0b"
          nodeId="id"
          nodeLabel={(n) => `<div style="max-width:300px"><b>${escapeHtml((n as Node).label)}</b><br/><span style="color:#888">${(n as Node).group}</span></div>`}
          nodeColor={(n) => colorFor((n as Node).group)}
          nodeOpacity={0.95}
          nodeResolution={12}
          linkColor={() => "rgba(180,180,200,0.15)"}
          linkWidth={(l) => Math.max(0.2, ((l as Link).value - 0.5) * 2)}
          linkOpacity={0.4}
          enableNodeDrag={false}
          onNodeClick={(n) => setSelected(n as Node)}
        />
      )}

      {data && (
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2 text-xs">
          {groups.map((g) => (
            <span
              key={g}
              className="rounded bg-panel/80 px-2 py-1 text-zinc-300"
              style={{ borderLeft: `3px solid ${colorFor(g)}` }}
            >
              {g}
            </span>
          ))}
          <span className="rounded bg-panel/80 px-2 py-1 text-zinc-500">
            {data.nodes.length} docs · {data.links.length} links
          </span>
        </div>
      )}

      {selected && (
        <aside className="absolute right-3 top-3 max-h-[70vh] w-80 overflow-auto rounded-lg border border-border bg-panel p-4 text-sm shadow-xl">
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
          <div className="mb-3 text-xs text-zinc-500">
            <span
              className="mr-2 inline-block rounded px-2 py-0.5"
              style={{ backgroundColor: `${colorFor(selected.group)}22`, color: colorFor(selected.group) }}
            >
              {selected.group}
            </span>
            {new Date(selected.createdAt).toLocaleString()}
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
