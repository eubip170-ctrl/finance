import { NextResponse } from "next/server";
import { runNewsApiIngest } from "@/lib/cron/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
    // Single search per cron run keeps the lifetime quota healthy. NewsAPI.ai
    // caps articlesCount at 100 on the free plan, sortBy=date gets the freshest.
    const result = await runNewsApiIngest({ query: { count: 100, sortBy: "date" } });
    return NextResponse.json({ ok: true, ...result, totalMs: Date.now() - t0 });
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
  return NextResponse.json({ ok: true, hint: "POST to ingest a batch from NewsAPI.ai" });
}
