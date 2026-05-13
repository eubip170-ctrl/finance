import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function loadEvents() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("events")
    .select("id,title,event_type,status,occurred_at,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return { events: [], error: error.message };
  return { events: data ?? [], error: null };
}

export default async function EventsPage() {
  let events: Array<{
    id: string;
    title: string;
    event_type: string;
    status: string;
    occurred_at: string | null;
    created_at: string;
  }> = [];
  let dbError: string | null = null;
  try {
    const r = await loadEvents();
    events = r.events;
    dbError = r.error;
  } catch (e) {
    dbError = e instanceof Error ? e.message : "unknown";
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Home
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-100">Events</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Seed eventi macro/geopolitici e pipeline studier.
          </p>
        </div>
        <Link
          href="/events/new"
          className="rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20"
        >
          + New event
        </Link>
      </div>

      {dbError && (
        <div className="mb-6 rounded-md border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
          DB error: {dbError}. Verifica le env Supabase e che la migration sia applicata.
        </div>
      )}

      {events.length === 0 && !dbError ? (
        <p className="text-zinc-500">Nessun evento ancora. Crea il primo.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-panel">
          {events.map((ev) => (
            <li key={ev.id} className="p-4 hover:bg-zinc-900/30">
              <Link href={`/events/${ev.id}`} className="flex items-center justify-between">
                <div>
                  <div className="text-zinc-100">{ev.title}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {ev.event_type} · {new Date(ev.created_at).toLocaleString()}
                  </div>
                </div>
                <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
                  {ev.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
