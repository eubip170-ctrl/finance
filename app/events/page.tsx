import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function loadEvents() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("events")
    .select("id,title,event_type,status,occurred_at,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
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
    <main className="px-3 py-3">
      <div className="flex items-center gap-3 border-b border-border pb-1">
        <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
          EVT
        </span>
        <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">EVENTS</h1>
        <Link
          href="/events/new"
          className="ml-auto border border-accent/60 px-2 py-0.5 text-2xs uppercase tracking-widest text-accent hover:bg-accent/10"
        >
          + NEW
        </Link>
      </div>

      {dbError && (
        <div className="mt-2 border border-neg/60 bg-neg/10 px-2 py-1 text-2xs uppercase text-neg">
          db error: {dbError}
        </div>
      )}

      {events.length === 0 && !dbError ? (
        <p className="mt-2 text-2xs uppercase text-zinc-600">no events yet</p>
      ) : (
        <div className="mt-2 overflow-x-auto border border-border bg-panel">
          <table className="w-full font-mono text-2xs tabular-nums">
            <thead>
              <tr className="border-b border-border bg-black/40 text-left uppercase tracking-widest text-zinc-500">
                <th className="px-2 py-1">TIME</th>
                <th className="px-2 py-1">TYPE</th>
                <th className="px-2 py-1">TITLE</th>
                <th className="px-2 py-1 text-right">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-border/60 last:border-0 hover:bg-black/40">
                  <td className="px-2 py-1 text-zinc-500">
                    {new Date(ev.created_at).toLocaleString(undefined, {
                      year: "2-digit",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-2 py-1 text-accent">{ev.event_type}</td>
                  <td className="px-2 py-1 text-zinc-100">
                    <Link href={`/events/${ev.id}`} className="hover:text-accent">
                      {ev.title}
                    </Link>
                  </td>
                  <td className="px-2 py-1 text-right uppercase text-zinc-400">{ev.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
