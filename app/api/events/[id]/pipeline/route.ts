import { NextResponse } from "next/server";
import { z } from "zod";
import { inngest } from "@/lib/inngest/client";

export const runtime = "nodejs";

const bodySchema = z.object({ maxRounds: z.number().int().min(1).max(20).optional() });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const maxRounds = parsed.success ? parsed.data.maxRounds : undefined;

  await inngest.send({
    name: "event/pipeline.requested",
    data: { eventId: id, maxRounds },
  });
  return NextResponse.json({ ok: true, dispatched: true });
}
