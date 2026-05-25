import { NextResponse } from "next/server";
import { getLatestProfile, generateEntityProfile } from "@/lib/brain/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const decoded = decodeURIComponent(name);
  try {
    const profile = await getLatestProfile(decoded);
    if (!profile) {
      return NextResponse.json({ ok: true, profile: null, message: "no profile yet" });
    }
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function POST(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const decoded = decodeURIComponent(name);
  try {
    const result = await generateEntityProfile(decoded);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
