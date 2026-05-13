import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("reports")
    .select("title,body_md,event_id,created_at")
    .eq("id", id)
    .single();

  if (error || !data) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-red-400">Report not found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href={`/events/${data.event_id}`}
        className="text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← Event
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">{data.title}</h1>
      <p className="mt-1 text-xs text-zinc-500">
        {new Date(data.created_at).toLocaleString()}
      </p>
      <pre className="mt-8 whitespace-pre-wrap rounded-lg border border-border bg-panel p-6 text-sm leading-relaxed text-zinc-200">
        {data.body_md}
      </pre>
    </main>
  );
}
