import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { enrichDocument } from "@/lib/brain/enrich";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Backfill the Phase-1 enrichment columns (summary / entities / topics /
 * sentiment) on documents where enriched_at IS NULL. Designed to be called
 * repeatedly from the Admin tab — each call processes up to MAX_DOCS docs
 * serially (gpt-4o-mini is cheap but rate-limited per second), reports
 * progress, and tells the client whether to loop again.
 */

const MAX_DOCS_PER_CALL = 20;

interface EnrichResponse {
  ok: boolean;
  remaining: number;
  processed: number;
  failed: number;
  durationMs: number;
  nextCall?: "yes" | "no";
}

export async function POST(): Promise<NextResponse<EnrichResponse | { error: string }>> {
  const t0 = Date.now();
  try {
    const supabase = supabaseAdmin();

    const { count: remainingBefore } = await supabase
      .from("brain_documents")
      .select("*", { count: "exact", head: true })
      .is("enriched_at", null);

    const { data: pending, error: pendingErr } = await supabase
      .from("brain_documents")
      .select("id,title,raw_text,source_type")
      .is("enriched_at", null)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(MAX_DOCS_PER_CALL);
    if (pendingErr) throw new Error(pendingErr.message);

    let processed = 0;
    let failed = 0;

    for (const doc of pending ?? []) {
      try {
        const meta = await enrichDocument({
          title: doc.title,
          rawText: doc.raw_text,
          sourceType: doc.source_type,
        });
        await supabase
          .from("brain_documents")
          .update({
            summary: meta.summary || null,
            entities: meta.entities,
            topics: meta.topics,
            sentiment: meta.sentiment,
            enriched_at: new Date().toISOString(),
          })
          .eq("id", doc.id);
        processed += 1;
      } catch (err) {
        console.error("enrich doc failed:", doc.id, err);
        failed += 1;
      }
    }

    const remainingAfter = Math.max(0, (remainingBefore ?? 0) - processed);

    return NextResponse.json({
      ok: true,
      remaining: remainingAfter,
      processed,
      failed,
      durationMs: Date.now() - t0,
      nextCall: remainingAfter > 0 ? "yes" : "no",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
