/**
 * Controlled topic vocabulary for the Brain corpus.
 *
 * The LLM is asked to pick up to N tags from this list rather than invent
 * its own — keeps the Library filter chips stable, avoids "rates" vs
 * "interest-rates" drift, and lets the graph/cluster code group docs by
 * a fixed coloured palette.
 *
 * Editing this file is the canonical way to extend the vocabulary; everything
 * downstream (UI chips, filter dropdowns, prompt) reads from these arrays.
 */

export const TOPIC_GROUPS = {
  macro: ["rates", "inflation", "growth", "central-banks", "fiscal", "fx", "liquidity"],
  assets: ["equities", "credit", "rates-bonds", "commodities", "crypto", "gold", "oil"],
  sectors: [
    "tech",
    "financials",
    "energy",
    "healthcare",
    "industrials",
    "consumer",
    "utilities",
    "materials",
    "real-estate",
    "communication",
  ],
  geo: ["us", "europe", "china", "em", "japan", "uk", "middle-east", "global"],
  themes: ["ai", "geopolitics", "earnings", "regulation", "election", "trade-war", "climate"],
  regimes: ["risk-on", "risk-off", "stagflation", "soft-landing", "recession", "reflation"],
} as const;

export const ALL_TOPICS: readonly string[] = Object.values(TOPIC_GROUPS).flat();

const TOPIC_SET = new Set<string>(ALL_TOPICS);

const TOPIC_ALIASES: Record<string, string> = {
  // common LLM variants we want to coerce back into the controlled vocab
  "interest-rates": "rates",
  "interest rates": "rates",
  bonds: "rates-bonds",
  treasuries: "rates-bonds",
  fed: "central-banks",
  ecb: "central-banks",
  boj: "central-banks",
  cpi: "inflation",
  ppi: "inflation",
  gdp: "growth",
  currency: "fx",
  forex: "fx",
  stocks: "equities",
  equity: "equities",
  technology: "tech",
  semis: "tech",
  banks: "financials",
  oil_gas: "energy",
  emerging: "em",
  europe_eu: "europe",
  "soft landing": "soft-landing",
  "risk on": "risk-on",
  "risk off": "risk-off",
};

/** Normalize a single raw topic candidate to the controlled vocab, or null if unknown. */
export function canonicalizeTopic(raw: string): string | null {
  const slug = raw.toLowerCase().trim().replace(/\s+/g, "-");
  if (TOPIC_SET.has(slug)) return slug;
  const aliased = TOPIC_ALIASES[slug] ?? TOPIC_ALIASES[raw.toLowerCase().trim()];
  return aliased ?? null;
}

/** Coerce + dedupe a list of LLM-proposed topics down to the controlled vocab. */
export function canonicalizeTopics(raws: string[], maxOut = 5): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of raws) {
    const c = canonicalizeTopic(r);
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
    if (out.length >= maxOut) break;
  }
  return out;
}

export const ENTITY_KINDS = [
  "ticker", // SPY, AAPL, EURUSD
  "company",
  "person",
  "central-bank",
  "country",
  "asset-class",
  "indicator", // CPI, NFP, ISM
  "event", // FOMC meeting, ECB press conf
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export type Entity = {
  kind: EntityKind;
  value: string; // canonical form, e.g. "Federal Reserve", "AAPL", "Jerome Powell"
};

export type Sentiment = "bullish" | "bearish" | "neutral";

const ENTITY_KIND_SET = new Set<string>(ENTITY_KINDS);

export function isEntity(x: unknown): x is Entity {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.kind === "string" &&
    ENTITY_KIND_SET.has(r.kind) &&
    typeof r.value === "string" &&
    r.value.length > 0 &&
    r.value.length < 120
  );
}
