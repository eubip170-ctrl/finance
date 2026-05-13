import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().min(1),
  summary: z.string().optional(),
  eventType: z.enum([
    "monetary_policy",
    "fiscal_policy",
    "geopolitical",
    "regulation",
    "macro_release",
    "corporate",
    "commodity",
    "energy",
    "other",
  ]),
  occurredAt: z.string().datetime().optional(),
  sourceUrl: z.string().url().optional(),
  rawText: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("events")
    .select("id,title,summary,event_type,occurred_at,status,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, events: data ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("events")
    .insert({
      title: parsed.data.title,
      summary: parsed.data.summary ?? null,
      event_type: parsed.data.eventType,
      occurred_at: parsed.data.occurredAt ?? null,
      source_url: parsed.data.sourceUrl ?? null,
      raw_text: parsed.data.rawText,
      metadata: parsed.data.metadata ?? {},
    })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message }, { status: 500 });
  return NextResponse.json({ ok: true, eventId: data.id });
}
