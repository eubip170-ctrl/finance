import { NextResponse } from "next/server";
import { writeCache } from "@/lib/cache/market-cache";
import { computeDashboardPayload } from "@/lib/dashboard/payload";
import { computeFocusPayload } from "@/lib/focus/payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured — only permit local invocations. In practice every
    // production deploy ships with CRON_SECRET set.
    return false;
  }
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

async function refresh() {
  const results: Record<string, { ok: boolean; ms: number; error?: string }> = {};
  const t0 = Date.now();

  // Dashboard
  const dStart = Date.now();
  try {
    const dash = await computeDashboardPayload();
    await writeCache("dashboard", dash);
    results.dashboard = { ok: true, ms: Date.now() - dStart };
  } catch (err) {
    results.dashboard = {
      ok: false,
      ms: Date.now() - dStart,
      error: err instanceof Error ? err.message : "unknown",
    };
  }

  // Focus
  const fStart = Date.now();
  try {
    const focus = await computeFocusPayload();
    await writeCache("focus", focus);
    results.focus = { ok: true, ms: Date.now() - fStart };
  } catch (err) {
    results.focus = {
      ok: false,
      ms: Date.now() - fStart,
      error: err instanceof Error ? err.message : "unknown",
    };
  }

  return {
    ok: Object.values(results).every((r) => r.ok),
    totalMs: Date.now() - t0,
    refreshedAt: new Date().toISOString(),
    results,
  };
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const out = await refresh();
  return NextResponse.json(out, { status: out.ok ? 200 : 207 });
}

// GET allows the GitHub Action to do a one-line check after POSTing.
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, hint: "POST to refresh" });
}
