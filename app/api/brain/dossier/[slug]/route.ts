import { NextResponse } from "next/server";
import { getLatestDossier, generateTopicDossier } from "@/lib/brain/dossier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  try {
    const dossier = await getLatestDossier(slug);
    if (!dossier) {
      return NextResponse.json({ ok: true, dossier: null, message: "no dossier yet" });
    }
    return NextResponse.json({ ok: true, dossier });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

/**
 * Regenerate the dossier for `slug`. Public so the operator can trigger
 * from the topic page without juggling secrets; an opportunistic call
 * costs ~$0.0005 in LLM spend.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  try {
    const result = await generateTopicDossier(slug);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
