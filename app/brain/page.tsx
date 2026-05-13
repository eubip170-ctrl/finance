"use client";

import { useState } from "react";
import Link from "next/link";

type Chunk = {
  id: string;
  documentId: string;
  content: string;
  similarity: number;
};

export default function BrainPage() {
  const [tab, setTab] = useState<"ingest" | "query">("ingest");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Home
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">Second Brain</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Ingest documenti e fai retrieval semantico sul tuo corpus privato.
      </p>

      <div className="mt-6 flex gap-2 border-b border-border">
        <Tab active={tab === "ingest"} onClick={() => setTab("ingest")}>
          Ingest
        </Tab>
        <Tab active={tab === "query"} onClick={() => setTab("query")}>
          Query
        </Tab>
      </div>

      {tab === "ingest" ? <IngestForm /> : <QueryForm />}
    </main>
  );
}

function Tab({
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
      className={`px-4 py-2 text-sm ${
        active
          ? "border-b-2 border-accent text-accent"
          : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

function IngestForm() {
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/brain/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: "manual", title, rawText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "failed");
      setStatus(`OK — ${json.chunkCount} chunks indexed`);
      setTitle("");
      setRawText("");
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        placeholder="Title"
        className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
      />
      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        required
        rows={14}
        placeholder="Paste content here..."
        className="w-full rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20 disabled:opacity-50"
      >
        {busy ? "Indexing…" : "Ingest"}
      </button>
      {status && <p className="text-xs text-zinc-400">{status}</p>}
    </form>
  );
}

function QueryForm() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Chunk[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/brain/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, matchCount: 6 }),
      });
      const json = await res.json();
      setResults(json.chunks ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          required
          placeholder="What are you looking for?"
          className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-accent disabled:opacity-50"
        >
          {busy ? "…" : "Search"}
        </button>
      </form>
      <ul className="space-y-2">
        {results.map((r) => (
          <li key={r.id} className="rounded border border-border bg-panel p-3">
            <div className="text-xs text-zinc-500">
              similarity {r.similarity.toFixed(3)}
            </div>
            <div className="mt-1 text-sm text-zinc-200">{r.content.slice(0, 600)}…</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
