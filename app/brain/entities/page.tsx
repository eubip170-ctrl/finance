import Link from "next/link";
import { listEntities } from "@/lib/brain/profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const KIND_TONE: Record<string, string> = {
  ticker: "text-accent",
  company: "text-zinc-200",
  person: "text-sky-300",
  "central-bank": "text-amber-300",
  country: "text-fuchsia-300",
  "asset-class": "text-pos",
  indicator: "text-zinc-400",
  event: "text-pos",
};

export default async function EntitiesIndexPage() {
  let entities: Awaited<ReturnType<typeof listEntities>> = [];
  let error: string | null = null;
  try {
    entities = await listEntities(120);
  } catch (err) {
    error = err instanceof Error ? err.message : "unknown";
  }

  // Group by kind for the index — easier to scan.
  const byKind = new Map<string, typeof entities>();
  for (const e of entities) {
    if (!byKind.has(e.kind)) byKind.set(e.kind, []);
    byKind.get(e.kind)!.push(e);
  }
  const kindOrder = [
    "ticker",
    "central-bank",
    "person",
    "company",
    "country",
    "indicator",
    "asset-class",
    "event",
  ];

  return (
    <main className="px-3 py-3">
      <div className="flex items-center gap-3 border-b border-border pb-1">
        <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
          BRN
        </span>
        <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">
          ENTITIES · LAST 60 DAYS
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

      {!error && entities.length === 0 && (
        <div className="mt-6 border border-border bg-panel px-3 py-6 text-center text-2xs uppercase tracking-widest text-zinc-500">
          No enriched docs in the last 60 days. Run BACKFILL ENRICHMENT
          from the Admin tab first.
        </div>
      )}

      {entities.length > 0 && (
        <div className="mt-3 space-y-3">
          {kindOrder
            .filter((k) => byKind.has(k))
            .concat(Array.from(byKind.keys()).filter((k) => !kindOrder.includes(k)))
            .map((kind) => {
              const list = byKind.get(kind) ?? [];
              return (
                <section key={kind} className="border border-border bg-panel">
                  <div className="flex items-center gap-2 border-b border-border bg-black/40 px-2 py-1">
                    <span
                      className={`text-2xs font-bold uppercase tracking-widest ${KIND_TONE[kind] ?? "text-zinc-300"}`}
                    >
                      {kind}
                    </span>
                    <span className="text-2xs uppercase tracking-widest text-zinc-500">
                      · {list.length}
                    </span>
                  </div>
                  <ul className="grid grid-cols-1 gap-1 px-2 py-2 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((e) => (
                      <li key={`${e.kind}:${e.name}`}>
                        <Link
                          href={`/brain/entity/${encodeURIComponent(e.name)}`}
                          className="flex items-center justify-between border border-border/60 bg-black/30 px-2 py-1 hover:border-accent"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                            {e.name}
                          </span>
                          {e.hasProfile && (
                            <span className="ml-2 text-2xs uppercase tracking-widest text-pos">
                              ●
                            </span>
                          )}
                          <span className="ml-2 font-mono text-2xs tabular-nums text-accent">
                            ×{e.mentions}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
        </div>
      )}
    </main>
  );
}
