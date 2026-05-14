import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EntityNode = {
  id: string;
  label: string; // visual name
  group: string; // entity label (CentralBank, Currency, AssetClass, ...)
  val: number;
  summary: string | null;
};

type RelationLink = {
  source: string;
  target: string;
  rel_type: string;
  fact: string | null;
};

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = supabaseAdmin();

  const [entitiesRes, relationsRes, eventRes] = await Promise.all([
    supabase
      .from("entities")
      .select("id,label,name,summary,attributes")
      .eq("event_id", id),
    supabase
      .from("relations")
      .select("source_id,target_id,rel_type,fact,valid_at")
      .eq("event_id", id),
    supabase.from("events").select("title,event_type,status").eq("id", id).single(),
  ]);

  if (entitiesRes.error) {
    return NextResponse.json({ error: entitiesRes.error.message }, { status: 500 });
  }
  if (relationsRes.error) {
    return NextResponse.json({ error: relationsRes.error.message }, { status: 500 });
  }

  // Node value = 1 + degree (more connected entities are bigger).
  const degree = new Map<string, number>();
  for (const r of relationsRes.data ?? []) {
    degree.set(r.source_id, (degree.get(r.source_id) ?? 0) + 1);
    degree.set(r.target_id, (degree.get(r.target_id) ?? 0) + 1);
  }

  const nodes: EntityNode[] = (entitiesRes.data ?? []).map((e) => ({
    id: e.id,
    label: e.name,
    group: e.label,
    val: 3 + Math.min(12, degree.get(e.id) ?? 0),
    summary: e.summary,
  }));

  const links: RelationLink[] = (relationsRes.data ?? []).map((r) => ({
    source: r.source_id,
    target: r.target_id,
    rel_type: r.rel_type,
    fact: r.fact,
  }));

  return NextResponse.json({
    ok: true,
    event: eventRes.data ?? null,
    nodes,
    links,
  });
}
