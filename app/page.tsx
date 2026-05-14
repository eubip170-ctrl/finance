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
        .limit(8),
      supabase
        .from("reports")
        .select("id,title,created_at")
        .order("created_at", { ascending: false })
        .limit(8),
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
    <main className="px-3 py-3">
      <PageHeader title="OVERVIEW" code="HOME" />

      {c.error && (
        <Panel code="!" title="DB ERROR" tone="neg">
          {c.error}
        </Panel>
      )}

      <section className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="DOCS" value={c.docs} />
        <Stat label="CHUNKS" value={c.chunks} />
        <Stat label="EVENTS" value={c.events} />
        <Stat label="REPORTS" value={c.reports} />
      </section>

      <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
        <Panel code="E1" title="RECENT EVENTS" right={<Link href="/events" className="text-accent hover:underline">ALL →</Link>}>
          {c.recentEvents.length === 0 ? (
            <Dim>no events yet — cron 2h</Dim>
          ) : (
            <ul className="divide-y divide-border">
              {c.recentEvents.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/events/${e.id}`}
                    className="flex items-center justify-between gap-2 py-1 hover:bg-panel"
                  >
                    <span className="truncate text-zinc-200">{e.title}</span>
                    <span className="shrink-0 text-2xs uppercase text-zinc-500">
                      {e.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel code="R1" title="RECENT REPORTS" right={<Link href="/reports" className="text-accent hover:underline">ALL →</Link>}>
          {c.recentReports.length === 0 ? (
            <Dim>no reports yet — cron 4h</Dim>
          ) : (
            <ul className="divide-y divide-border">
              {c.recentReports.map((r) => (
                <li key={r.id} className="py-1">
                  <Link href={`/reports/${r.id}`} className="block truncate text-zinc-200 hover:text-accent">
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <Tile k="1" href="/dashboard" code="DASH" label="Market dashboard" />
        <Tile k="2" href="/focus" code="FOCUS" label="Macro focus" />
        <Tile k="3" href="/charts" code="CHRT" label="Charts" />
        <Tile k="4" href="/brain" code="BRN" label="Second brain" />
        <Tile k="5" href="/brain/graph" code="GRPH" label="Knowledge graph" />
        <Tile k="6" href="/markets" code="MKTS" label="Markets" />
        <Tile k="7" href="/events" code="EVT" label="Events" />
        <Tile k="8" href="/reports" code="REP" label="Reports" />
      </div>
    </main>
  );
}

function PageHeader({ title, code }: { title: string; code: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border pb-1">
      <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
        {code}
      </span>
      <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">
        {title}
      </h1>
    </div>
  );
}

function Panel({
  code,
  title,
  right,
  tone = "normal",
  children,
}: {
  code: string;
  title: string;
  right?: React.ReactNode;
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
        <span className="text-2xs font-medium uppercase tracking-widest text-zinc-300">
          {title}
        </span>
        {right && <span className="ml-auto text-2xs">{right}</span>}
      </div>
      <div className="px-2 py-2 text-xs">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border bg-panel px-2 py-1">
      <div className="text-2xs uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="font-mono text-lg tabular-nums text-accent">{value}</div>
    </div>
  );
}

function Tile({ k, href, code, label }: { k: string; href: string; code: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 border border-border bg-panel px-2 py-2 transition hover:border-accent"
    >
      <div className="min-w-0">
        <div className="text-2xs font-bold uppercase tracking-widest text-accent">
          {k}) {code}
        </div>
        <div className="truncate text-2xs uppercase tracking-wider text-zinc-300">
          {label}
        </div>
      </div>
      <span className="text-accent">→</span>
    </Link>
  );
}

function Dim({ children }: { children: React.ReactNode }) {
  return <p className="text-2xs uppercase text-zinc-600">{children}</p>;
}
