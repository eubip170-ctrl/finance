import { supabaseAdmin } from "@/lib/supabase/server";
import { MODELS, completeJSON } from "@/lib/llm/anthropic";
import { ONTOLOGY_PROMPT, SYSTEM_MACRO_ANALYST } from "./prompts";

type LLMOntology = {
  entities: Array<{
    label: string;
    name: string;
    summary?: string;
    attributes?: Record<string, unknown>;
  }>;
  relations: Array<{
    source: string;
    target: string;
    rel_type: string;
    fact?: string;
    valid_at?: string | null;
    invalid_at?: string | null;
  }>;
};

const ALLOWED_LABELS = new Set([
  "CentralBank",
  "Government",
  "Regulator",
  "Sovereign",
  "Corporation",
  "Sector",
  "AssetClass",
  "Currency",
  "Commodity",
  "MacroIndicator",
  "GeographicRegion",
  "MarketActor",
  "Other",
]);

export async function buildOntology(eventId: string): Promise<{
  entitiesInserted: number;
  relationsInserted: number;
}> {
  const supabase = supabaseAdmin();

  const { data: ev, error } = await supabase
    .from("events")
    .select("id,title,summary,raw_text")
    .eq("id", eventId)
    .single();
  if (error || !ev) throw new Error(`event not found: ${error?.message}`);

  const seed = `${ev.title}\n\n${ev.summary ?? ""}\n\n${ev.raw_text}`.trim();

  const llmOut = await completeJSON<LLMOntology>({
    model: MODELS.reasoning,
    system: SYSTEM_MACRO_ANALYST,
    prompt: ONTOLOGY_PROMPT(seed),
    maxTokens: 4000,
    temperature: 0.2,
  });

  const entities = (llmOut.entities ?? []).filter((e) => ALLOWED_LABELS.has(e.label));
  if (entities.length === 0) throw new Error("LLM produced 0 valid entities");

  const entityRows = entities.map((e) => ({
    event_id: eventId,
    label: e.label,
    name: e.name,
    summary: e.summary ?? null,
    attributes: e.attributes ?? {},
  }));

  const { data: insertedEntities, error: entErr } = await supabase
    .from("entities")
    .upsert(entityRows, { onConflict: "event_id,label,name" })
    .select("id,name");
  if (entErr) throw new Error(`entities insert failed: ${entErr.message}`);

  const nameToId = new Map((insertedEntities ?? []).map((e) => [e.name, e.id]));

  const relationRows = (llmOut.relations ?? [])
    .map((r) => {
      const sourceId = nameToId.get(r.source);
      const targetId = nameToId.get(r.target);
      if (!sourceId || !targetId) return null;
      return {
        event_id: eventId,
        source_id: sourceId,
        target_id: targetId,
        rel_type: r.rel_type,
        fact: r.fact ?? null,
        valid_at: r.valid_at ?? null,
        invalid_at: r.invalid_at ?? null,
        attributes: {},
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (relationRows.length > 0) {
    const { error: relErr } = await supabase.from("relations").insert(relationRows);
    if (relErr) throw new Error(`relations insert failed: ${relErr.message}`);
  }

  await supabase
    .from("events")
    .update({ status: "graph_built", updated_at: new Date().toISOString() })
    .eq("id", eventId);

  return {
    entitiesInserted: insertedEntities?.length ?? 0,
    relationsInserted: relationRows.length,
  };
}
