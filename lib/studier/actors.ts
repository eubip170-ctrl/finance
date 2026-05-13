import { supabaseAdmin } from "@/lib/supabase/server";
import { MODELS, completeJSON } from "@/lib/llm/anthropic";
import { ACTORS_PROMPT, SYSTEM_MACRO_ANALYST } from "./prompts";

const ALLOWED_ARCHETYPES = new Set([
  "central_bank",
  "treasury",
  "sovereign_wealth",
  "pension_fund",
  "hedge_fund_macro",
  "hedge_fund_event",
  "asset_manager",
  "market_maker",
  "prop_desk",
  "retail_aggregate",
  "corporate_treasury",
  "other",
]);

type LLMActors = {
  actors: Array<{
    archetype: string;
    name: string;
    source_entity_name?: string | null;
    mandate: string;
    risk_tolerance: "low" | "medium" | "high" | "speculative";
    horizon: "intraday" | "days" | "weeks" | "months" | "years";
    primary_assets: string[];
    biases?: Record<string, string>;
    persona: string;
  }>;
};

export async function generateActors(eventId: string): Promise<{ actorsInserted: number }> {
  const supabase = supabaseAdmin();

  const { data: ev, error: evErr } = await supabase
    .from("events")
    .select("title,summary")
    .eq("id", eventId)
    .single();
  if (evErr || !ev) throw new Error(`event not found: ${evErr?.message}`);

  const { data: entities, error: entErr } = await supabase
    .from("entities")
    .select("id,label,name,summary,attributes")
    .eq("event_id", eventId);
  if (entErr) throw new Error(`entities load failed: ${entErr.message}`);
  if (!entities || entities.length === 0) {
    throw new Error("no entities found — build the ontology first");
  }

  const entitiesForPrompt = entities.map((e) => ({
    label: e.label,
    name: e.name,
    summary: e.summary,
    attributes: e.attributes,
  }));
  const nameToEntityId = new Map(entities.map((e) => [e.name, e.id]));

  const llmOut = await completeJSON<LLMActors>({
    model: MODELS.reasoning,
    system: SYSTEM_MACRO_ANALYST,
    prompt: ACTORS_PROMPT(
      ev.title,
      ev.summary ?? "",
      JSON.stringify(entitiesForPrompt, null, 2),
    ),
    maxTokens: 4000,
    temperature: 0.4,
  });

  const valid = (llmOut.actors ?? []).filter((a) => ALLOWED_ARCHETYPES.has(a.archetype));
  if (valid.length === 0) throw new Error("LLM produced 0 valid actors");

  const rows = valid.map((a) => ({
    event_id: eventId,
    source_entity_id: a.source_entity_name ? nameToEntityId.get(a.source_entity_name) ?? null : null,
    archetype: a.archetype,
    name: a.name,
    mandate: a.mandate,
    risk_tolerance: a.risk_tolerance,
    horizon: a.horizon,
    primary_assets: a.primary_assets ?? [],
    biases: a.biases ?? {},
    persona: a.persona,
  }));

  const { error: insErr } = await supabase.from("actors").insert(rows);
  if (insErr) throw new Error(`actors insert failed: ${insErr.message}`);

  await supabase
    .from("events")
    .update({ status: "actors_generated", updated_at: new Date().toISOString() })
    .eq("id", eventId);

  return { actorsInserted: rows.length };
}
