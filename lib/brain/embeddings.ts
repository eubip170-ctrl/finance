/**
 * Embeddings provider abstraction.
 * Default: Voyage AI (voyage-3, 1024 dims) — matches the schema in 0001_initial_schema.sql.
 * Fallback: OpenAI text-embedding-3-small (set EMBEDDINGS_PROVIDER=openai and OPENAI_API_KEY).
 *
 * If you change the dimension, you MUST update brain_chunks.embedding and rebuild the index.
 */

const VOYAGE_MODEL = "voyage-3";
const OPENAI_MODEL = "text-embedding-3-small"; // 1536 dims — NOT compatible with 1024 schema

export type EmbeddingInput = string | string[];

export async function embed(input: EmbeddingInput): Promise<number[][]> {
  const provider = (process.env.EMBEDDINGS_PROVIDER ?? "voyage").toLowerCase();
  const texts = Array.isArray(input) ? input : [input];
  if (texts.length === 0) return [];

  if (provider === "voyage") return embedVoyage(texts);
  if (provider === "openai") return embedOpenAI(texts);
  throw new Error(`Unknown EMBEDDINGS_PROVIDER: ${provider}`);
}

async function embedVoyage(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY missing");
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: VOYAGE_MODEL, input: texts, input_type: "document" }),
  });
  if (!res.ok) throw new Error(`Voyage embed failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
}

async function embedOpenAI(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: OPENAI_MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`OpenAI embed failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
}
