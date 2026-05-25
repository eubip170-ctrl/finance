import { NextResponse } from "next/server";
import { listTopics } from "@/lib/brain/dossier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const topics = await listTopics();
    return NextResponse.json({ ok: true, topics });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
