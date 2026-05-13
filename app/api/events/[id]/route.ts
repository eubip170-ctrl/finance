import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = supabaseAdmin();

  const [evRes, entRes, relRes, actRes, simRes, repRes] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).single(),
    supabase.from("entities").select("*").eq("event_id", id),
    supabase
      .from("relations")
      .select("id,source_id,target_id,rel_type,fact,valid_at")
      .eq("event_id", id),
    supabase.from("actors").select("*").eq("event_id", id),
    supabase
      .from("simulations")
      .select("id,status,max_rounds,started_at,finished_at,error,created_at")
      .eq("event_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("reports")
      .select("id,title,created_at,simulation_id")
      .eq("event_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (evRes.error || !evRes.data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    event: evRes.data,
    entities: entRes.data ?? [],
    relations: relRes.data ?? [],
    actors: actRes.data ?? [],
    simulations: simRes.data ?? [],
    reports: repRes.data ?? [],
  });
}
