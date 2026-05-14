import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Counters = {
  docs: number;
  chunks: number;
  events: number;
  reports: number;
  recentEvents: Array<{ id: string; title: string; event_type: string; status: string; created_at: string }>;
  recentReports: Array<{ id: string; title: string; created_at: string }>;
  error: string | null;
};

async function loadCounters(): Promise<Counters> {
  try {
    const supabase = supabaseAdmin();
    const [docs, chunks, events, reports, recentE, recentR] = await Promise.all([
      supabase.from("brain_documents").select("*", { count: "exact", head: true }),
      supabase.from("brain_chunks").select("*", { count: "exact", head: true }),
      supabase.from("events").select("*", { count: "exact", head: true }),
      supabase.from("reports").select("*", { count: "exact", head: true }),
      supabase
        .from("events")
        .select("id,title,event_type,status,created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("reports")
        .select("id,title,created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    return {
      docs: docs.count ?? 0,
      chunks: chunks.count ?? 0,
      events: events.count ?? 0,
      reports: reports.count ?? 0,
      recentEvents: recentE.data ?? [],
      recentReports: recentR.data ?? [],
      error: null,
    };
  } catch (err) {
    return {
      docs: 0,
      chunks: 0,
      events: 0,
      reports: 0,
      recentEvents: [],
      recentReports: [],
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

export default async function HomePage() {
  const c = await loadCounters();

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-100">
          Event / Macro Studier
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          Autonomous investment research. Cron jobs ingest macro news every 30 min,
          classify them into events, then run multi-actor simulations and produce
          scenario reports. No manual seeding needed.
        </p>
      </header>

      {c.error && (
        <div className="mb-6 rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          DB error: {c.error}. Verifica env Supabase e migration.
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Brain docs" value={c.docs} />
        <Stat label="Chunks" value={c.chunks} />
        <Stat label="Events" value={c.events} />
        <Stat label="Reports" value={c.reports} />
      </section>

      <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel title="Recent events" href="/events">
          {c.recentEvents.length === 0 ? (
            <Empty>Nessun evento ancora — il cron parte ogni 2h.</Empty>
          ) : (
            <ul className="space-y-2">
              {c.recentEvents.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/events/${e.id}`}
                    className="flex items-center justify-between text-sm hover:text-accent"
                  >
                    <span className="truncate text-zinc-200">{e.title}</span>
                    <span className="ml-2 shrink-0 rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                      {e.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent reports" href="/reports">
          {c.recentReports.length === 0 ? (
            <Empty>Nessun report ancora — il pipeline cron parte ogni 4h.</Empty>
          ) : (
            <ul className="space-y-2">
              {c.recentReports.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/reports/${r.id}`}
                    className="block truncate text-sm text-zinc-200 hover:text-accent"
                  >
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card
          href="/dashboard"
          title="Market Dashboard"
          description="Cross-asset pulse, top movers, performance matrix e sector heatmap (live Yahoo)."
        />
        <Card
          href="/focus"
          title="Focus"
          description="Eventi macro/geopolitici monitorati con score, momentum e regime di mercato."
        />
        <Card
          href="/charts"
          title="Charts"
          description="Analisi tecnica con SMA/EMA, drawdown, vol realizzata e returns multi-window."
        />
        <Card
          href="/events"
          title="Events"
          description="Eventi macro/geopolitici classificati automaticamente dal news feed."
        />
        <Card
          href="/brain"
          title="Second Brain"
          description="Corpus auto-popolato da RSS curati (Fed, ECB, BoE, Treasury, Reuters, FT)."
        />
        <Card
          href="/markets"
          title="Markets"
          description="Watchlist live (Yahoo v8) + news feed RSS aggregato."
        />
        <Card
          href="/reports"
          title="Reports"
          description="Scenario report generati dalla simulazione multi-attore."
        />
      </section>

      <footer className="mt-16 text-xs text-zinc-500">
        Sprint 1 — Event Studier foundations. Built on Next.js · Supabase · OpenAI · Inngest.
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl text-zinc-100">{value}</div>
    </div>
  );
}

function Panel({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
          {title}
        </h2>
        <Link href={href} className="text-xs text-zinc-500 hover:text-accent">
          See all →
        </Link>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-500">{children}</p>;
}

function Card({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-panel p-5 transition hover:border-accent/40"
    >
      <h2 className="text-lg font-medium text-zinc-100">{title}</h2>
      <p className="mt-2 text-sm text-zinc-400">{description}</p>
    </Link>
  );
}
