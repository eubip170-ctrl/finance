import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { embed } from "@/lib/brain/embeddings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_CHUNKS_PER_CALL = 80;
const BATCH_SIZE = 16;

interface ReembedResponse {
  ok: boolean;
  remaining: number;
  processed: number;
  failed: number;
  durationMs: number;
  nextCall?: "yes" | "no";
}

export async function POST(): Promise<NextResponse<ReembedResponse | { error: string }>> {
  const t0 = Date.now();
  try {
    const supabase = supabaseAdmin();

    // Snapshot remaining first so the client can show progress between calls.
    const { count: remainingBefore } = await supabase
      .from("brain_chunks")
      .select("*", { count: "exact", head: true })
      .is("embedding", null);

    const { data: pending, error: pendingErr } = await supabase
      .from("brain_chunks")
      .select("id,content")
      .is("embedding", null)
      .limit(MAX_CHUNKS_PER_CALL);
    if (pendingErr) throw new Error(pendingErr.message);

    let processed = 0;
    let failed = 0;
    const chunks = (pending ?? []) as Array<{ id: string; content: string }>;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      try {
        const vectors = await embed(batch.map((c) => c.content));
        await Promise.all(
          batch.map((c, idx) => {
            const v = vectors[idx];
            if (!v || !Array.isArray(v) || v.length === 0) {
              failed += 1;
              return Promise.resolve();
            }
            return supabase
              .from("brain_chunks")
              .update({ embedding: v as unknown as string })
              .eq("id", c.id);
          }),
        );
        processed += batch.length;
      } catch (err) {
        // Log but continue with next batch; the chunk stays unembedded so a
        // future call will retry it.
        console.error("reembed batch failed:", err);
        failed += batch.length;
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
