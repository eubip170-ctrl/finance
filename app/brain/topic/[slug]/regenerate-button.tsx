"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function RegenerateButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/brain/dossier/${encodeURIComponent(slug)}`, {
        method: "POST",
      });
      const j = await res.json();
      if (!res.ok || j.ok === false) {
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-1 border border-accent/60 px-2 py-0.5 text-2xs uppercase tracking-widest text-accent hover:bg-accent/10 disabled:opacity-40"
      >
        <RefreshCw size={11} className={busy ? "animate-spin" : ""} />
        {busy ? "REGEN…" : "REGENERATE"}
      </button>
      {error && (
        <span className="text-2xs uppercase tracking-widest text-neg">{error}</span>
      )}
    </>
  );
}
