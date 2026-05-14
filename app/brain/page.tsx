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

async function loadBrainStats() {
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
          .limit(20),
        supabase.from("brain_documents").select("source_type"),
      ]);
    const bySource: Record<string, number> = {};
    for (const r of all ?? []) bySource[r.source_type] = (bySource[r.source_type] ?? 0) + 1;
    return {
      docCount: docCount ?? 0,
      chunkCount: chunkCount ?? 0,
      recent: (recent ?? []) as RecentDoc[],
      bySource,
      error: null as string | null,
    };
  } catch (err) {
    return {
      docCount: 0,
      chunkCount: 0,
      recent: [] as RecentDoc[],
      bySource: {} as Record<string, number>,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

export default async function BrainPage() {
  const stats = await loadBrainStats();

  return (
    <main className="px-3 py-3">
      <div className="flex items-center gap-3 border-b border-border pb-1">
        <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
          BRN
        </span>
        <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">
          SECOND BRAIN
        </h1>
        <Link
          href="/brain/graph"
          className="ml-auto border border-accent/60 px-2 py-0.5 text-2xs uppercase tracking-widest text-accent hover:bg-accent/10"
        >
          GRPH →
        </Link>
      </div>

      {stats.error && (
        <Panel code="!" title="DB ERROR" tone="neg">
          {stats.error}
        </Panel>
      )}

      <section className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="DOCS" value={stats.docCount} />
        <Stat label="CHUNKS" value={stats.chunkCount} />
        <Stat label="SOURCES" value={Object.keys(stats.bySource).length} />
        <Stat label="TOP" value={topSource(stats.bySource) ?? "—"} />
      </section>

      <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-2">
        <Panel code="D1" title="RECENTLY INGESTED">
          {stats.recent.length === 0 ? (
            <p className="text-2xs uppercase text-zinc-600">
              no docs yet — wait for rss cron (30m) or /api/seed
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {stats.recent.map((d) => (
                <li key={d.id} className="py-1">
                  {d.source_url ? (
                    <a
                      href={d.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-xs text-zinc-200 hover:text-accent"
                    >
                      {d.title}
                    </a>
                  ) : (
                    <span className="block truncate text-xs text-zinc-200">{d.title}</span>
                  )}
                  <div className="text-2xs uppercase tracking-widest text-zinc-600">
                    {d.source_type} · {new Date(d.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel code="I1" title="INGEST / QUERY">
          <BrainForms />
        </Panel>
      </div>
    </main>
  );
}

function Panel({
  code,
  title,
  tone = "normal",
  children,
}: {
  code: string;
  title: string;
  tone?: "normal" | "neg";
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-panel">
      <div className="flex items-center gap-2 border-b border-border bg-black/40 px-2 py-1">
        <span
          className={`text-2xs font-bold uppercase tracking-widest ${
            tone === "neg" ? "text-neg" : "text-accent"
          }`}
        >
          {code}
        </span>
        <span className="text-2xs font-medium uppercase tracking-widest text-zinc-300">{title}</span>
      </div>
      <div className="px-2 py-2">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-border bg-panel px-2 py-1">
      <div className="text-2xs uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="font-mono text-lg tabular-nums text-accent">{value}</div>
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
