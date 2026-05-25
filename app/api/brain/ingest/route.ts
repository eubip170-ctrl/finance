import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestDocument } from "@/lib/brain/ingest";

export const runtime = "nodejs";
export const maxDuration = 60;

const ingestSchema = z.object({
  sourceType: z.enum([
    "news",
    "rss",
    "pdf",
    "manual",
    "sim_output",
    "market_note",
    "transcript",
    "brief",
  ]),
  title: z.string().min(1),
  rawText: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  author: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await ingestDocument(parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
