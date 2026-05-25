import { NextResponse } from "next/server";
import { getLatestBrief } from "@/lib/brain/brief";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const latest = await getLatestBrief();
    if (!latest) {
      return NextResponse.json({ ok: true, brief: null, message: "no brief yet" });
    }
    return NextResponse.json({ ok: true, brief: latest });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
