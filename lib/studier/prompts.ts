/**
 * Prompt templates for the Event/Macro Studier pipeline.
 * Inspired by MiroFish's stages (ontology → profiles → simulation → report)
 * but reoriented to macro & geopolitical market analysis.
 */

export const SYSTEM_MACRO_ANALYST = `You are a senior macro & geopolitical analyst with 20 years of experience covering
central banks, sovereigns, asset managers and capital flows. You produce concise,
structured analysis grounded in textbook macro and market-structure reasoning. You
NEVER fabricate numbers. When unsure, you say so explicitly.`;

export const ONTOLOGY_PROMPT = (eventText: string) => `
You will extract a knowledge graph from a macro/geopolitical event. The graph drives
a downstream multi-actor simulation of market reactions.

Event text:
"""
${eventText}
"""

Allowed entity labels (use exactly these strings):
- CentralBank, Government, Regulator, Sovereign
- Corporation, Sector, AssetClass, Currency, Commodity
- MacroIndicator, GeographicRegion, MarketActor, Other

Return strictly JSON, no prose, no markdown fences:
{
  "entities": [
    { "label": "<one of allowed>", "name": "<canonical name>", "summary": "<≤200 chars>", "attributes": { ... } }
  ],
  "relations": [
    { "source": "<entity name>", "target": "<entity name>", "rel_type": "<verb_or_short_phrase>",
      "fact": "<≤200 chars>", "valid_at": "<ISO8601 or null>", "invalid_at": null }
  ]
}

Rules:
- 8–20 entities, the most causally relevant only.
- Always include the directly impacted CentralBank / Government / Currency / AssetClass.
- Relation names should be lower_snake_case verbs (e.g. "sets_policy_for", "is_funded_in", "exports_to").
`;

export const ACTORS_PROMPT = (eventTitle: string, eventSummary: string, entitiesJson: string) => `
Given the event and its knowledge graph, generate the cast of MARKET ACTORS that will
participate in a multi-round simulation of market reaction.

Event title: ${eventTitle}
Event summary: ${eventSummary}

Knowledge graph entities (JSON):
${entitiesJson}

Generate 5–9 actors. Each actor must have a clear mandate and observable trading style.
Use the archetypes EXACTLY as listed:
- central_bank, treasury, sovereign_wealth, pension_fund
- hedge_fund_macro, hedge_fund_event, asset_manager
- market_maker, prop_desk, retail_aggregate, corporate_treasury, other

Return strictly JSON:
{
  "actors": [
    {
      "archetype": "<one of allowed>",
      "name": "<short label, e.g. 'Macro HF (event-driven)' >",
      "source_entity_name": "<name from entities[] or null>",
      "mandate": "<≤300 chars>",
      "risk_tolerance": "low|medium|high|speculative",
      "horizon": "intraday|days|weeks|months|years",
      "primary_assets": ["<asset class or ticker>", ...],
      "biases": { "<bias_name>": "<short>" },
      "persona": "<≤500 chars, first-person voice describing how this actor thinks>"
    }
  ]
}
`;

export const ROUND_DECISION_PROMPT = (params: {
  eventSummary: string;
  actor: { name: string; archetype: string; mandate: string; persona: string; primaryAssets: string[] };
  roundNumber: number;
  worldState: string;
  recentActions: string;
}) => `
Round ${params.roundNumber}. You are acting as:

Name: ${params.actor.name}
Archetype: ${params.actor.archetype}
Primary assets: ${params.actor.primaryAssets.join(", ") || "—"}
Mandate: ${params.actor.mandate}
Persona: ${params.actor.persona}

Event under analysis:
"""
${params.eventSummary}
"""

Current world state:
"""
${params.worldState}
"""

What the other actors did in the previous rounds:
"""
${params.recentActions || "(this is the first round)"}
"""

Pick ONE concrete action consistent with your mandate and risk profile. Be specific
about direction, asset class and conviction. Avoid vague language.

Return strictly JSON:
{
  "action_type": "buy|sell|hedge|hold|communicate|policy_signal|position_unwind|other",
  "rationale": "<≤400 chars, why now>",
  "payload": {
    "instrument": "<asset class / ticker / curve point>",
    "direction": "long|short|neutral|n/a",
    "size_qualifier": "small|moderate|large|n/a",
    "horizon": "intraday|days|weeks|months",
    "confidence": 0.0
  }
}
`;

export const REPORT_PROMPT = (params: {
  eventTitle: string;
  eventSummary: string;
  entitiesJson: string;
  actorsJson: string;
  actionsJson: string;
  brainContext: string;
}) => `
Compose a scenario research report on the following event, using the simulation log
and additional context retrieved from the analyst's Second Brain.

EVENT
Title: ${params.eventTitle}
Summary: ${params.eventSummary}

ENTITIES (knowledge graph):
${params.entitiesJson}

ACTORS:
${params.actorsJson}

SIMULATION ACTIONS (by round):
${params.actionsJson}

ADDITIONAL CONTEXT FROM SECOND BRAIN:
${params.brainContext || "(none)"}

Write a markdown report with these sections:
1. **Executive summary** (3–5 bullets)
2. **Base / bull / bear scenarios** (probabilistic, with the asset classes that move most)
3. **Most impacted assets** (table: asset | direction | conviction | horizon | rationale)
4. **Key risks & invalidation triggers**
5. **What to watch next** (data releases, price levels, statements)

At the very end of the markdown, append a fenced JSON block (\`\`\`json) with:
{
  "scenarios": [ { "name": "...", "probability": 0.0, "summary": "...", "key_drivers": ["..."] } ],
  "impacted_assets": [ { "asset": "...", "direction": "long|short|neutral", "conviction": "low|medium|high", "horizon": "intraday|days|weeks|months" } ]
}
The JSON block must be valid JSON — it will be parsed.
`;
