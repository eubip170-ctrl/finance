import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { RunPipelineButton } from "./run-pipeline-button";

export const dynamic = "force-dynamic";

async function loadEvent(id: string) {
  const supabase = supabaseAdmin();
  const [ev, entities, actors, sims, reports] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).single(),
    supabase.from("entities").select("label,name,summary").eq("event_id", id),
    supabase.from("actors").select("name,archetype,mandate,horizon").eq("event_id", id),
    supabase
      .from("simulations")
      .select("id,status,max_rounds,started_at,finished_at,created_at")
      .eq("event_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("reports")
      .select("id,title,created_at")
      .eq("event_id", id)
      .order("created_at", { ascending: false }),
  ]);
  return {
    event: ev.data,
    entities: entities.data ?? [],
    actors: actors.data ?? [],
    sims: sims.data ?? [],
    reports: reports.data ?? [],
    error: ev.error?.message,
  };
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event, entities, actors, sims, reports, error } = await loadEvent(id);

  if (error || !event) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-red-400">Event not found: {error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/events" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Events
      </Link>

      <header className="mt-2 flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold sm:text-3xl">
            {event.title}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            {event.event_type} · status{" "}
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
              {event.status}
            </span>
          </p>
        </div>
        <RunPipelineButton eventId={id} />
      </header>

      {event.summary && <p className="mt-4 text-zinc-300">{event.summary}</p>}

      <Section title={`Entities (${entities.length})`}>
        {entities.length === 0 ? (
          <Empty>Run the pipeline to extract the knowledge graph.</Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {entities.map((e) => (
              <li
                key={`${e.label}-${e.name}`}
                className="rounded border border-border bg-panel p-3"
              >
                <div className="text-xs uppercase tracking-wide text-zinc-500">{e.label}</div>
                <div className="text-zinc-100">{e.name}</div>
                {e.summary && <div className="mt-1 text-xs text-zinc-400">{e.summary}</div>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Market actors (${actors.length})`}>
        {actors.length === 0 ? (
          <Empty>No actors yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {actors.map((a) => (
              <li key={a.name} className="rounded border border-border bg-panel p-3">
                <div className="flex items-center justify-between">
                  <div className="text-zinc-100">{a.name}</div>
                  <div className="text-xs text-zinc-500">
                    {a.archetype} · {a.horizon}
                  </div>
                </div>
                {a.mandate && <div className="mt-1 text-xs text-zinc-400">{a.mandate}</div>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Simulations (${sims.length})`}>
        {sims.length === 0 ? (
          <Empty>No simulations yet.</Empty>
        ) : (
          <ul className="space-y-1 text-sm">
            {sims.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded border border-border bg-panel p-3"
              >
                <span className="font-mono text-xs text-zinc-400">{s.id.slice(0, 8)}</span>
                <span>
                  {s.status} · {s.max_rounds} rounds
                </span>
                <span className="text-xs text-zinc-500">
                  {new Date(s.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Reports (${reports.length})`}>
        {reports.length === 0 ? (
          <Empty>No reports yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/reports/${r.id}`}
                  className="block rounded border border-border bg-panel p-3 hover:border-accent/40"
                >
                  <div className="text-zinc-100">{r.title}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-500">{children}</p>;
}
