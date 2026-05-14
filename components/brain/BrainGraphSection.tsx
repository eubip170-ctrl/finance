"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

// The 3D canvas pulls in three.js, so we load it lazily and only on the client.
// This keeps the initial /brain bundle small for users who don't open the viz.
const BrainGraph3D = dynamic(
  () => import("./BrainGraph3D").then((m) => m.BrainGraph3D),
  { ssr: false, loading: () => <Loading /> },
);

function Loading() {
  return (
    <div className="flex h-[420px] items-center justify-center rounded-lg border border-border bg-panel text-sm text-zinc-500">
      Initialising 3D scene…
    </div>
  );
}

export function BrainGraphSection() {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
          Embedding map
        </h2>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent transition hover:bg-accent/20"
        >
          {open ? "Hide 3D view" : "Open 3D view"}
        </button>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Every chunk in the second brain projected from its 1024-dim embedding
        down to 3 axes via PCA. Drag to rotate, scroll to zoom, hover a point
        to preview the source document.
      </p>
      {open && (
        <div className="mt-4">
          <BrainGraph3D />
        </div>
      )}
    </section>
  );
}
