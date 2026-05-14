import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BrainForms } from "./forms";

export const dynamic = "force-dynamic";

type RecentDoc = {
  id: string;
  title: string;
  source_type: string;
  source_url: string | null;
  published_at: string | null;
  created_at: string;
};

async function loadBrainStats(): Promise<{
  docCount: number;
  chunkCount: number;
  recent: RecentDoc[];
  bySource: Record<string, number>;
  error: string | null;
}> {
  try {
    const supabase = supabaseAdmin();
    const [{ count: docCount }, { count: chunkCount }, { data: recent }, { data: all }] =
      await Promise.all([
        supabase.from("brain_documents").select("*", { count: "exact", head: true }),
        supabase.from("brain_chunks").select("*", { count: "exact", head: true }),
        supabase
          .from("brain_documents")
          .select("id,title,source_type,source_url,published_at,created_at")
          .order("created_at", { ascending: false })
          .limit(15),
        supabase.from("brain_documents").select("source_type"),
      ]);

    const bySource: Record<string, number> = {};
    for (const r of all ?? []) {
      bySource[r.source_type] = (bySource[r.source_type] ?? 0) + 1;
    }

    return {
      docCount: docCount ?? 0,
      chunkCount: chunkCount ?? 0,
      recent: (recent ?? []) as RecentDoc[],
      bySource,
      error: null,
    };
  } catch (err) {
    return {
      docCount: 0,
      chunkCount: 0,
      recent: [],
      bySource: {},
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

export default async function BrainPage() {
  const stats = await loadBrainStats();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Home
          </Link>
          <h1 className="mt-2 text-3xl font-semibold">Second Brain</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Ingestione automatica da RSS (banche centrali, treasuries, macro news) ogni 30
            minuti. Retrieval semantico sul corpus indicizzato.
          </p>
        </div>
        <Link
          href="/brain/graph"
          className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent hover:bg-accent/20"
        >
          🌐 3D Graph
        </Link>
      </div>

      {stats.error && (
        <div className="mt-4 rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          DB error: {stats.error}
        </div>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Documents" value={stats.docCount} />
        <Stat label="Chunks" value={stats.chunkCount} />
        <Stat label="Sources" value={Object.keys(stats.bySource).length} />
        <Stat
          label="Top source"
          value={topSource(stats.bySource) ?? "—"}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
          Recently ingested
        </h2>
        {stats.recent.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Niente ancora. Aspetta il prossimo cron RSS (ogni 30 min) o lancia
            <code className="ml-1 rounded bg-zinc-800 px-1 text-xs">/api/seed</code> per
            popolare subito.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-panel">
            {stats.recent.map((d) => (
              <li key={d.id} className="p-3">
                {d.source_url ? (
                  <a
                    href={d.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-zinc-200 hover:text-accent"
                  >
                    {d.title}
                  </a>
                ) : (
                  <span className="text-sm text-zinc-200">{d.title}</span>
                )}
                <div className="mt-1 text-xs text-zinc-500">
                  {d.source_type} · {new Date(d.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BrainForms />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-lg text-zinc-100">{value}</div>
    </div>
  );
}

function topSource(by: Record<string, number>): string | null {
  let top: string | null = null;
  let max = 0;
  for (const [k, v] of Object.entries(by)) {
    if (v > max) {
      max = v;
      top = k;
    }
  }
  return top;
}
