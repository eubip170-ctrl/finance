import Link from "next/link";
import { listTopics } from "@/lib/brain/dossier";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TopicsIndexPage() {
  let topics: Awaited<ReturnType<typeof listTopics>> = [];
  let error: string | null = null;
  try {
    topics = await listTopics();
  } catch (err) {
    error = err instanceof Error ? err.message : "unknown";
  }

  return (
    <main className="px-3 py-3">
      <div className="flex items-center gap-3 border-b border-border pb-1">
        <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
          BRN
        </span>
        <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">
          TOPICS · LAST 30 DAYS
        </h1>
        <Link
          href="/brain"
          className="ml-auto border border-accent/60 px-2 py-0.5 text-2xs uppercase tracking-widest text-accent hover:bg-accent/10"
        >
          ← BRAIN
        </Link>
      </div>

      {error && (
        <div className="mt-3 border border-neg/60 bg-neg/10 px-3 py-2 text-2xs uppercase tracking-widest text-neg">
          {error}
        </div>
      )}

      {!error && topics.length === 0 && (
        <div className="mt-6 border border-border bg-panel px-3 py-6 text-center text-2xs uppercase tracking-widest text-zinc-500">
          No enriched docs in the last 30 days. Run the BACKFILL ENRICHMENT
          job from the Admin tab first.
        </div>
      )}

      {topics.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((t) => (
            <Link
              key={t.topic}
              href={`/brain/topic/${encodeURIComponent(t.topic)}`}
              className="flex items-center justify-between border border-border bg-panel px-3 py-2 hover:border-accent"
            >
              <div className="min-w-0 flex-1">
                <div className="text-2xs font-bold uppercase tracking-widest text-zinc-200">
                  {t.topic}
                </div>
                <div className="text-2xs uppercase tracking-widest text-zinc-500">
                  {t.docCount} docs ·{" "}
                  {t.hasDossier && t.lastDossierAt ? (
                    <span className="text-pos">
                      dossier · {new Date(t.lastDossierAt).toUTCString().slice(5, 16)}
                    </span>
                  ) : (
                    <span className="text-zinc-600">no dossier yet</span>
                  )}
                </div>
              </div>
              <span className="ml-2 font-mono text-lg tabular-nums text-accent">
                {t.docCount}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
