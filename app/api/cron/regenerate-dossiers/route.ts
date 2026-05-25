import { NextResponse } from "next/server";
import { generateTopicDossier, listTopics } from "@/lib/brain/dossier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TOP_N = 12;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (req.headers.get("authorization") || "") === `Bearer ${secret}`;
}

/**
 * Regenerate dossiers for the top-N most-active topics in the last
 * 30-day window. Runs serially so a slow LLM call can't compound across
 * 12 topics and bust maxDuration. Each topic that fails (e.g. <4 docs)
 * is recorded but does not stop the batch.
 */
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const t0 = Date.now();
  try {
    const topics = await listTopics();
    const slice = topics.slice(0, TOP_N);
    const results: Array<{
      topic: string;
      ok: boolean;
      docCount: number;
      ms: number;
      error?: string;
    }> = [];

    for (const t of slice) {
      const ts = Date.now();
      try {
        const { dossier } = await generateTopicDossier(t.topic);
        results.push({ topic: t.topic, ok: true, docCount: dossier.docCount, ms: Date.now() - ts });
      } catch (err) {
        results.push({
          topic: t.topic,
          ok: false,
          docCount: t.docCount,
          ms: Date.now() - ts,
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    return NextResponse.json({
      ok: results.every((r) => r.ok),
      attempted: slice.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      totalMs: Date.now() - t0,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, hint: "POST to regenerate dossiers" });
}
