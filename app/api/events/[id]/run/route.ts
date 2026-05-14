import { NextResponse } from "next/server";
import { z } from "zod";
import { inngest } from "@/lib/inngest/client";

export const runtime = "nodejs";

const bodySchema = z.object({
  stage: z.enum(["ontology", "actors", "simulation", "report", "pipeline"]),
  simulationId: z.string().uuid().optional(),
  maxRounds: z.number().int().min(1).max(20).optional(),
});

const STAGE_EVENT_MAP: Record<string, string> = {
  ontology: "event/ontology.requested",
  actors: "event/actors.requested",
  simulation: "event/simulation.requested",
  report: "event/report.requested",
  pipeline: "event/pipeline.requested",
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const eventName = STAGE_EVENT_MAP[parsed.data.stage];
  const sent = await inngest.send({
    name: eventName,
    data: {
      eventId: id,
      ...(parsed.data.simulationId ? { simulationId: parsed.data.simulationId } : {}),
      ...(parsed.data.maxRounds ? { maxRounds: parsed.data.maxRounds } : {}),
    },
  });

  return NextResponse.json({ ok: true, stage: parsed.data.stage, ids: sent.ids });
}
