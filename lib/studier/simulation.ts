import { supabaseAdmin } from "@/lib/supabase/server";
import { MODELS, completeJSON } from "@/lib/llm/anthropic";
import { ROUND_DECISION_PROMPT, SYSTEM_MACRO_ANALYST } from "./prompts";

type ActorRow = {
  id: string;
  name: string;
  archetype: string;
  mandate: string | null;
  persona: string | null;
  primary_assets: string[] | null;
};

type Decision = {
  action_type: string;
  rationale: string;
  payload: Record<string, unknown>;
};

export async function createSimulation(
  eventId: string,
  opts: { maxRounds?: number; config?: Record<string, unknown> } = {},
): Promise<{ simulationId: string }> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("simulations")
    .insert({
      event_id: eventId,
      status: "pending",
      max_rounds: opts.maxRounds ?? 6,
      config: opts.config ?? {},
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`simulation insert failed: ${error?.message}`);
  return { simulationId: data.id };
}

/**
 * Execute one round for one actor. Designed to be called as a single Inngest step so
 * each LLM call stays well under Vercel's function timeout.
 */
export async function runActorRound(
  simulationId: string,
  actorId: string,
  roundNumber: number,
): Promise<Decision> {
  const supabase = supabaseAdmin();

  const { data: sim, error: simErr } = await supabase
    .from("simulations")
    .select("event_id")
    .eq("id", simulationId)
    .single();
  if (simErr || !sim) throw new Error("simulation not found");

  const { data: ev } = await supabase
    .from("events")
    .select("summary,raw_text")
    .eq("id", sim.event_id)
    .single();

  const { data: actor, error: actErr } = await supabase
    .from("actors")
    .select("id,name,archetype,mandate,persona,primary_assets")
    .eq("id", actorId)
    .single<ActorRow>();
  if (actErr || !actor) throw new Error("actor not found");

  const { data: recent } = await supabase
    .from("actor_actions")
    .select("round_number,action_type,rationale,payload,actor_id,actors(name,archetype)")
    .eq("simulation_id", simulationId)
    .order("round_number", { ascending: true })
    .limit(50);

  const recentText = (recent ?? [])
    .map((a) => {
      const actorMeta = (a as { actors?: { name?: string; archetype?: string } }).actors;
      const who = actorMeta ? `${actorMeta.name} (${actorMeta.archetype})` : "unknown";
      return `R${a.round_number} · ${who} → ${a.action_type}: ${a.rationale}`;
    })
    .join("\n");

  const worldState = ev?.summary ?? ev?.raw_text?.slice(0, 1200) ?? "(no summary)";

  const decision = await completeJSON<Decision>({
    model: MODELS.reasoning,
    system: SYSTEM_MACRO_ANALYST,
    prompt: ROUND_DECISION_PROMPT({
      eventSummary: worldState,
      actor: {
        name: actor.name,
        archetype: actor.archetype,
        mandate: actor.mandate ?? "",
        persona: actor.persona ?? "",
        primaryAssets: actor.primary_assets ?? [],
      },
      roundNumber,
      worldState,
      recentActions: recentText,
    }),
    maxTokens: 1500,
    temperature: 0.6,
  });

  await supabase.from("actor_actions").insert({
    simulation_id: simulationId,
    actor_id: actorId,
    round_number: roundNumber,
    action_type: decision.action_type,
    rationale: decision.rationale,
    payload: decision.payload,
  });

  return decision;
}

export async function listActorIds(eventId: string): Promise<string[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("actors")
    .select("id")
    .eq("event_id", eventId);
  if (error) throw new Error(`list actors failed: ${error.message}`);
  return (data ?? []).map((a) => a.id);
}

export async function markSimulation(
  simulationId: string,
  status: "running" | "completed" | "failed",
  errorMsg?: string,
) {
  const supabase = supabaseAdmin();
  const patch: Record<string, unknown> = { status };
  if (status === "running") patch.started_at = new Date().toISOString();
  if (status === "completed" || status === "failed") {
    patch.finished_at = new Date().toISOString();
  }
  if (errorMsg) patch.error = errorMsg;
  await supabase.from("simulations").update(patch).eq("id", simulationId);
}
