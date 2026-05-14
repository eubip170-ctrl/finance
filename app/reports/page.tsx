import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReportsListPage() {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("reports")
    .select("id,title,created_at,event_id")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <main className="px-3 py-3">
      <div className="flex items-center gap-3 border-b border-border pb-1">
        <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
          REP
        </span>
        <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">REPORTS</h1>
      </div>

      {!data || data.length === 0 ? (
        <p className="mt-2 text-2xs uppercase text-zinc-600">no reports yet</p>
      ) : (
        <div className="mt-2 overflow-x-auto border border-border bg-panel">
          <table className="w-full font-mono text-2xs tabular-nums">
            <thead>
              <tr className="border-b border-border bg-black/40 text-left uppercase tracking-widest text-zinc-500">
                <th className="px-2 py-1">TIME</th>
                <th className="px-2 py-1">TITLE</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-black/40">
                  <td className="px-2 py-1 text-zinc-500">
                    {new Date(r.created_at).toLocaleString(undefined, {
                      year: "2-digit",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-2 py-1">
                    <Link href={`/reports/${r.id}`} className="text-zinc-100 hover:text-accent">
                      {r.title}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
