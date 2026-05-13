import { supabaseAdmin } from "@/lib/supabase/server";
import { MODELS, completeText } from "@/lib/llm/anthropic";
import { retrieve } from "@/lib/brain/retrieve";
import { REPORT_PROMPT, SYSTEM_MACRO_ANALYST } from "./prompts";

type ReportPayload = {
  scenarios: unknown[];
  impacted_assets: unknown[];
};

export async function generateReport(
  eventId: string,
  simulationId?: string,
): Promise<{ reportId: string; bodyMd: string }> {
  const supabase = supabaseAdmin();

  const { data: ev, error: evErr } = await supabase
    .from("events")
    .select("title,summary,raw_text")
    .eq("id", eventId)
    .single();
  if (evErr || !ev) throw new Error(`event not found: ${evErr?.message}`);

  const { data: entities } = await supabase
    .from("entities")
    .select("label,name,summary")
    .eq("event_id", eventId);

  const { data: actors } = await supabase
    .from("actors")
    .select("name,archetype,mandate,horizon,risk_tolerance,primary_assets")
    .eq("event_id", eventId);

  let actionsCompact = "(no simulation actions)";
  if (simulationId) {
    const { data: actions } = await supabase
      .from("actor_actions")
      .select("round_number,action_type,rationale,payload,actors(name,archetype)")
      .eq("simulation_id", simulationId)
      .order("round_number", { ascending: true });
    if (actions && actions.length > 0) {
      actionsCompact = actions
        .map((a) => {
          const actorMeta = (a as { actors?: { name?: string; archetype?: string } }).actors;
          const who = actorMeta ? `${actorMeta.name} (${actorMeta.archetype})` : "unknown";
          return `R${a.round_number} · ${who} → ${a.action_type}: ${a.rationale} · ${JSON.stringify(a.payload)}`;
        })
        .join("\n");
    }
  }

  const brainQuery = `${ev.title} ${ev.summary ?? ""}`.trim();
  const brainChunks = await retrieve(brainQuery, { matchCount: 6, minSimilarity: 0.3 });
  const brainContext = brainChunks
    .map((c, i) => `[BRAIN ${i + 1}] ${c.content}`)
    .join("\n\n");

  const bodyMd = await completeText({
    model: MODELS.reasoning,
    system: SYSTEM_MACRO_ANALYST,
    prompt: REPORT_PROMPT({
      eventTitle: ev.title,
      eventSummary: ev.summary ?? ev.raw_text.slice(0, 1500),
      entitiesJson: JSON.stringify(entities ?? [], null, 2),
      actorsJson: JSON.stringify(actors ?? [], null, 2),
      actionsJson: actionsCompact,
      brainContext,
    }),
    maxTokens: 6000,
    temperature: 0.5,
  });

  const parsed = extractTrailingJson(bodyMd);

  const { data: report, error: repErr } = await supabase
    .from("reports")
    .insert({
      event_id: eventId,
      simulation_id: simulationId ?? null,
      title: `Scenario report — ${ev.title}`,
      body_md: bodyMd,
      scenarios: parsed.scenarios,
      impacted_assets: parsed.impacted_assets,
    })
    .select("id")
    .single();
  if (repErr || !report) throw new Error(`report insert failed: ${repErr?.message}`);

  await supabase
    .from("events")
    .update({ status: "reported", updated_at: new Date().toISOString() })
    .eq("id", eventId);

  return { reportId: report.id, bodyMd };
}

function extractTrailingJson(md: string): ReportPayload {
  const match = md.match(/```json\s*([\s\S]+?)```\s*$/i);
  if (!match) return { scenarios: [], impacted_assets: [] };
  try {
    const obj = JSON.parse(match[1]);
    return {
      scenarios: Array.isArray(obj.scenarios) ? obj.scenarios : [],
      impacted_assets: Array.isArray(obj.impacted_assets) ? obj.impacted_assets : [],
    };
  } catch {
    return { scenarios: [], impacted_assets: [] };
  }
}
