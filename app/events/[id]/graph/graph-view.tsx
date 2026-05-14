"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

type Node = {
  id: string;
  label: string;
  group: string;
  val: number;
  summary: string | null;
};
type Link = { source: string | Node; target: string | Node; rel_type: string; fact: string | null };
type GraphData = { nodes: Node[]; links: Link[]; event: { title?: string } | null };

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

// One distinct colour per entity label.
const LABEL_COLORS: Record<string, string> = {
  CentralBank: "#5aa8ff",
  Government: "#9b6dff",
  Regulator: "#b58eff",
  Sovereign: "#7a7aff",
  Corporation: "#e83e8c",
  Sector: "#f7d046",
  AssetClass: "#d4af37",
  Currency: "#3fb98f",
  Commodity: "#ff7a59",
  MacroIndicator: "#6dd3ff",
  GeographicRegion: "#b8b8c8",
  MarketActor: "#ff9bda",
  Other: "#7a7a82",
};

function colorFor(group: string): string {
  return LABEL_COLORS[group] ?? LABEL_COLORS.Other;
}

function getId(endpoint: string | Node): string {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

export function EventGraphView({ eventId }: { eventId: string }) {
  const [data, setData] = useState<GraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Node | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/graph`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error) setError(j.error);
        else setData({ nodes: j.nodes ?? [], links: j.links ?? [], event: j.event });
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [eventId]);

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

  const nodeById = useMemo(() => {
    const m = new Map<string, Node>();
    for (const n of data?.nodes ?? []) m.set(n.id, n);
    return m;
  }, [data]);

  function resolve(endpoint: string | Node | undefined): Node | undefined {
    if (!endpoint) return undefined;
    if (typeof endpoint === "string") return nodeById.get(endpoint);
    return endpoint;
  }

  const labelCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of data?.nodes ?? []) m.set(n.group, (m.get(n.group) ?? 0) + 1);
    return m;
  }, [data]);

  return (
    <div ref={containerRef} className="relative h-full w-full bg-bg">
      {error && (
        <div className="absolute left-4 top-4 z-10 max-w-sm rounded border border-red-900 bg-red-950/70 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {!data && !error && (
        <div className="flex h-full items-center justify-center font-mono text-zinc-500">
          Caricamento entities…
        </div>
      )}
      {data && data.nodes.length === 0 && (
        <div className="flex h-full items-center justify-center font-mono text-zinc-500">
          Nessuna entity — la pipeline non è stata ancora eseguita.
        </div>
      )}

      {data && data.nodes.length > 0 && dims.w > 0 && (
        <ForceGraph3D
          graphData={{ nodes: data.nodes, links: data.links }}
          width={dims.w}
          height={dims.h}
          backgroundColor="#0a0a0b"
          nodeId="id"
          nodeLabel={(n) => {
            const node = n as Node;
            const sum = node.summary ? `<br/><span style="color:#aaa">${escapeHtml(node.summary.slice(0, 180))}</span>` : "";
            return `<div style="max-width:320px;padding:4px 6px"><b>${escapeHtml(node.label)}</b><br/><span style="color:#888;font-size:11px">${escapeHtml(node.group)}</span>${sum}</div>`;
          }}
          nodeColor={(n) => colorFor((n as Node).group)}
          nodeOpacity={0.95}
          nodeResolution={16}
          linkColor={(l) => {
            const s = resolve(l.source as string | Node | undefined);
            return s ? colorFor(s.group) : "#b8b8c8";
          }}
          linkWidth={() => 0.9}
          linkOpacity={0.6}
          linkDirectionalArrowLength={5}
          linkDirectionalArrowRelPos={0.92}
          linkDirectionalParticles={1}
          linkDirectionalParticleSpeed={0.005}
          linkDirectionalParticleWidth={1.5}
          linkLabel={(l) => `<span style="font-family:monospace">${escapeHtml((l as Link).rel_type)}</span>`}
          enableNodeDrag={false}
          onNodeClick={(n) => setSelected(n as Node)}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          warmupTicks={50}
        />
      )}

      {data && labelCounts.size > 0 && (
        <>
          <button
            onClick={() => setLegendOpen((v) => !v)}
            className="absolute left-3 top-3 z-20 rounded-md border border-border bg-panel/90 px-3 py-1.5 font-mono text-xs text-zinc-200 backdrop-blur md:hidden"
          >
            {legendOpen ? "✕ Close" : `☰ Legend (${labelCounts.size})`}
          </button>
          <aside
            className={`pointer-events-auto absolute left-3 z-10 max-w-[88vw] rounded-lg border border-border bg-panel/95 p-3 font-mono text-xs backdrop-blur sm:max-w-xs md:block ${
              legendOpen ? "top-14 block" : "hidden md:top-3"
            } md:top-3`}
          >
            <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
              Entity labels
            </div>
            <ul className="space-y-1">
              {[...labelCounts.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([label, count]) => (
                  <li key={label} className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: colorFor(label) }}
                    />
                    <span className="flex-1 text-zinc-200">{label}</span>
                    <span className="text-zinc-500">{count}</span>
                  </li>
                ))}
            </ul>
            <div className="mt-2 border-t border-border pt-2 text-[10px] text-zinc-500">
              {data.nodes.length} entities · {data.links.length} relations
            </div>
          </aside>
        </>
      )}

      {selected && (
        <aside className="absolute inset-x-3 bottom-3 z-20 max-h-[55vh] overflow-auto rounded-lg border border-border bg-panel p-4 font-mono text-sm shadow-xl md:inset-x-auto md:bottom-auto md:right-3 md:top-3 md:max-h-[75vh] md:w-80">
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
          <div className="mb-3">
            <span
              className="rounded px-2 py-0.5 text-xs"
              style={{
                backgroundColor: `${colorFor(selected.group)}22`,
                color: colorFor(selected.group),
              }}
            >
              {selected.group}
            </span>
          </div>
          {selected.summary && (
            <p className="whitespace-pre-wrap text-xs text-zinc-300">{selected.summary}</p>
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
