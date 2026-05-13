import { NextResponse } from "next/server";
import { z } from "zod";
import { retrieve } from "@/lib/brain/retrieve";

export const runtime = "nodejs";

const querySchema = z.object({
  query: z.string().min(1),
  matchCount: z.number().int().min(1).max(50).optional(),
  minSimilarity: z.number().min(0).max(1).optional(),
  filterSource: z
    .enum(["news", "rss", "pdf", "manual", "sim_output", "market_note", "transcript"])
    .nullable()
    .optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = querySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const chunks = await retrieve(parsed.data.query, {
      matchCount: parsed.data.matchCount,
      minSimilarity: parsed.data.minSimilarity,
      filterSource: parsed.data.filterSource,
    });
    return NextResponse.json({ ok: true, chunks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
