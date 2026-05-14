"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

type Point = {
  id: string;
  title: string;
  source: string;
  snippet: string;
  x: number;
  y: number;
  z: number;
};

type ApiResponse = {
  points?: Point[];
  sourceTypes?: string[];
  truncated?: boolean;
  total?: number;
  error?: string;
};

// Stable palette per source_type. Keys are matched case-insensitive against
// the source value coming back from the API.
const SOURCE_COLORS: Record<string, string> = {
  rss: "#d4af37",
  manual: "#34d399",
  fed: "#60a5fa",
  ecb: "#a78bfa",
  bis: "#f472b6",
  treasury: "#fbbf24",
  reuters: "#fb923c",
  ft: "#22d3ee",
  unknown: "#7a7a82",
};

function colorFor(source: string): THREE.Color {
  const key = source.toLowerCase();
  const hex = SOURCE_COLORS[key] ?? hashColor(key);
  return new THREE.Color(hex);
}

function hashColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 55%, 60%)`;
}

export function BrainGraph3D() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSources, setActiveSources] = useState<Set<string> | null>(null);
  const [hovered, setHovered] = useState<Point | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/brain/embeddings")
      .then((r) => r.json())
      .then((j: ApiResponse) => {
        if (cancelled) return;
        if (j.error) setError(j.error);
        else setData(j);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "unknown");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Initialise the visibility set when data arrives.
  useEffect(() => {
    if (data?.sourceTypes && activeSources == null) {
      setActiveSources(new Set(data.sourceTypes));
    }
  }, [data, activeSources]);

  const filtered = useMemo(() => {
    if (!data?.points) return [];
    if (!activeSources) return data.points;
    return data.points.filter((p) => activeSources.has(p.source));
  }, [data, activeSources]);

  if (loading) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-lg border border-border bg-panel text-sm text-zinc-500">
        Loading embeddings…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
        Embeddings error: {error}
      </div>
    );
  }
  if (!data || filtered.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-lg border border-border bg-panel text-sm text-zinc-500">
        No embeddings to plot. Ingest documents first.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Source filter */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">
          Sources
        </span>
        {data.sourceTypes?.map((s) => {
          const active = activeSources?.has(s) ?? true;
          return (
            <button
              key={s}
              onClick={() =>
                setActiveSources((prev) => {
                  const base = prev ?? new Set(data.sourceTypes);
                  const next = new Set(base);
                  if (next.has(s)) next.delete(s);
                  else next.add(s);
                  return next;
                })
              }
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition ${
                active
                  ? "border-zinc-600 bg-bg/40 text-zinc-200"
                  : "border-border text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: `#${colorFor(s).getHexString()}` }}
              />
              {s}
            </button>
          );
        })}
        <span className="ml-auto text-[10px] uppercase tracking-wider text-zinc-500">
          {filtered.length}/{data.total ?? filtered.length} chunks
          {data.truncated ? " · truncated" : ""}
        </span>
        <button
          onClick={() => setAutoRotate((v) => !v)}
          className="rounded border border-border bg-panel px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400 hover:text-zinc-100"
        >
          {autoRotate ? "Pause spin" : "Resume spin"}
        </button>
      </div>

      <div className="relative h-[460px] overflow-hidden rounded-lg border border-border bg-panel">
        <Canvas camera={{ position: [2.2, 1.6, 2.2], fov: 50 }} dpr={[1, 2]}>
          <ambientLight intensity={0.6} />
          <pointLight position={[3, 3, 3]} intensity={0.8} />
          <Cloud points={filtered} onHover={setHovered} />
          <axesHelper args={[1.1]} />
          <OrbitControls
            enablePan={false}
            autoRotate={autoRotate}
            autoRotateSpeed={0.6}
            minDistance={1.4}
            maxDistance={6}
          />
        </Canvas>

        {hovered && (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded border border-border bg-bg/90 p-3 backdrop-blur">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: `#${colorFor(hovered.source).getHexString()}` }}
              />
              {hovered.source}
            </div>
            <div className="mt-1 text-sm text-zinc-100">{hovered.title}</div>
            <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{hovered.snippet}</p>
          </div>
        )}

        <div className="pointer-events-none absolute right-3 top-3 rounded border border-border bg-bg/80 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-500">
          PCA · 1024D → 3D · drag · scroll · click points
        </div>
      </div>
    </div>
  );
}

function Cloud({
  points,
  onHover,
}: {
  points: Point[];
  onHover: (p: Point | null) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const { gl } = useThree();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Re-write the instance matrices and colors whenever the filtered set changes.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const color = new THREE.Color();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(0.022);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.copy(colorFor(p.source));
      mesh.setColorAt(i, color);
    }
    mesh.count = points.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [points, dummy, gl]);

  // Gentle pulse on the whole cloud to make it feel alive.
  useFrame((state) => {
    const m = meshRef.current;
    if (!m) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    const t = state.clock.elapsedTime;
    mat.opacity = 0.85 + Math.sin(t * 1.2) * 0.05;
  });

  function onPointerMove(e: ThreeEvent<PointerEvent>) {
    const id = e.instanceId;
    if (id == null) return;
    onHover(points[id] ?? null);
  }

  function onPointerOut() {
    onHover(null);
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, Math.max(1, points.length)]}
      onPointerMove={onPointerMove}
      onPointerOut={onPointerOut}
    >
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial transparent opacity={0.9} roughness={0.4} metalness={0.1} />
    </instancedMesh>
  );
}
