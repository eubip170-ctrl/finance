"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunPipelineButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/events/${eventId}/pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxRounds: 4 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "request failed");
      setMsg("Pipeline dispatched. Refresh in ~1 minute.");
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "unknown");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <button
        onClick={run}
        disabled={busy}
        className="rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20 disabled:opacity-50"
      >
        {busy ? "Dispatching…" : "Run pipeline"}
      </button>
      {msg && <p className="mt-2 text-xs text-zinc-400">{msg}</p>}
    </div>
  );
}
