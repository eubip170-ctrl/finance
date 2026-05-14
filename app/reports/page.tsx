import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReportsListPage() {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("reports")
    .select("id,title,created_at,event_id")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="px-6 py-8">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Home
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">Reports</h1>
      {!data || data.length === 0 ? (
        <p className="mt-6 text-zinc-500">No reports yet.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {data.map((r) => (
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
    </main>
  );
}
