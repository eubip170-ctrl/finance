import { NextResponse } from "next/server";
import { listEntities } from "@/lib/brain/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit") ?? 100) || 100), 500);
  try {
    const entities = await listEntities(limit);
    return NextResponse.json({ ok: true, entities });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
