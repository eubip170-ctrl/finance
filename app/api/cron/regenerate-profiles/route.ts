import { NextResponse } from "next/server";
import { generateEntityProfile, listEntities } from "@/lib/brain/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TOP_N = 20;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (req.headers.get("authorization") || "") === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const t0 = Date.now();
  try {
    const entities = await listEntities(TOP_N);
    const results: Array<{
      name: string;
      kind: string;
      ok: boolean;
      mentions: number;
      ms: number;
      error?: string;
    }> = [];

    for (const e of entities) {
      const ts = Date.now();
      try {
        const { profile } = await generateEntityProfile(e.name);
        results.push({
          name: e.name,
          kind: e.kind,
          ok: true,
          mentions: profile.docCount,
          ms: Date.now() - ts,
        });
      } catch (err) {
        results.push({
          name: e.name,
          kind: e.kind,
          ok: false,
          mentions: e.mentions,
          ms: Date.now() - ts,
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    return NextResponse.json({
      ok: results.every((r) => r.ok),
      attempted: entities.length,
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
  return NextResponse.json({ ok: true, hint: "POST to regenerate profiles" });
}
