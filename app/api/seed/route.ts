import { NextResponse } from "next/server";
import { runRssIngest, runNewsApiIngest } from "@/lib/cron/jobs";
import { detectEventsFromBrain, listUnprocessedEvents } from "@/lib/studier/event-detector";
import { inngest } from "@/lib/inngest/client";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Manual bootstrap endpoint. POST (or GET) it once after deploying with all
 * env vars configured. It will:
 *   1. Pull RSS feeds and populate the Second Brain.
 *   2. Run the event detector to create draft events.
 *   3. Dispatch the full pipeline for up to 3 high-impact events.
 *
 * Idempotent: dedupes by source URL and event document id.
 *
 * Optional protection: set SEED_TOKEN to require ?token=... on the URL.
 * Leave unset to allow open access (fine for personal tools).
 */
export async function POST(req: Request) {
  return run(req);
}

export async function GET(req: Request) {
  return run(req);
}

async function run(req: Request) {
  const expected = process.env.SEED_TOKEN;
  if (expected) {
    const { searchParams } = new URL(req.url);
    const tokenFromQuery = searchParams.get("token");
    const tokenFromHeader = req.headers.get("x-seed-token");
    if (tokenFromQuery !== expected && tokenFromHeader !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const out: Record<string, unknown> = {};

  try {
    out.rss = await runRssIngest({ maxItems: 80 });
  } catch (err) {
    out.rss_error = err instanceof Error ? err.message : String(err);
  }

  try {
    out.newsapi = await runNewsApiIngest({ maxItems: 80, hoursBack: 48 });
  } catch (err) {
    out.newsapi_error = err instanceof Error ? err.message : String(err);
  }

  try {
    out.detect = await detectEventsFromBrain({
      lookbackHours: 48,
      maxDocs: 40,
      minImpactToCreate: 0.4,
    });
  } catch (err) {
    out.detect_error = err instanceof Error ? err.message : String(err);
  }

  try {
    const top = await listUnprocessedEvents(3);
    out.candidates = top;
    for (const c of top) {
      await inngest.send({
        name: "event/pipeline.requested",
        data: { eventId: c.id, maxRounds: 4 },
      });
    }
    out.dispatched = top.length;
  } catch (err) {
    out.dispatch_error = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({ ok: true, ...out });
}
