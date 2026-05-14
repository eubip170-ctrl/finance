import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ReportRenderer } from "@/components/ReportRenderer";

export const dynamic = "force-dynamic";

type ReportRow = {
  title: string;
  body_md: string;
  event_id: string;
  created_at: string;
  scenarios: unknown;
  impacted_assets: unknown;
};

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("reports")
    .select("title,body_md,event_id,created_at,scenarios,impacted_assets")
    .eq("id", id)
    .single<ReportRow>();

  if (error || !data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-red-400">Report not found.</p>
      </main>
    );
  }

  const scenarios = Array.isArray(data.scenarios)
    ? (data.scenarios as Array<Record<string, unknown>>).map((s) => ({
        name: s.name as string | undefined,
        probability: s.probability as number | undefined,
        summary: s.summary as string | undefined,
        key_drivers: s.key_drivers as string[] | undefined,
      }))
    : [];

  const impactedAssets = Array.isArray(data.impacted_assets)
    ? (data.impacted_assets as Array<Record<string, unknown>>).map((a) => ({
        asset: a.asset as string | undefined,
        direction: a.direction as string | undefined,
        conviction: a.conviction as string | undefined,
        horizon: a.horizon as string | undefined,
        rationale: a.rationale as string | undefined,
      }))
    : [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href={`/events/${data.event_id}`}
        className="font-mono text-xs text-zinc-500 hover:text-accent"
      >
        ← Event
      </Link>
      <div className="mt-3">
        <ReportRenderer
          title={data.title}
          createdAt={data.created_at}
          body={data.body_md}
          scenarios={scenarios}
          impactedAssets={impactedAssets}
        />
      </div>
    </main>
  );
}
