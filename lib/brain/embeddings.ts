/**
 * Embeddings — defaults to OpenAI text-embedding-3-small.
 *
 * IMPORTANT: we force `dimensions: 1024` so the output matches the
 * vector(1024) column in the Supabase schema. If you change provider
 * or model, update brain_chunks.embedding and rebuild the IVFFlat index.
 */

const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const TARGET_DIMENSIONS = 1024;

export type EmbeddingInput = string | string[];

export async function embed(input: EmbeddingInput): Promise<number[][]> {
  const provider = (process.env.EMBEDDINGS_PROVIDER ?? "openai").toLowerCase();
  const texts = Array.isArray(input) ? input : [input];
  if (texts.length === 0) return [];

  if (provider === "openai") return embedOpenAI(texts);
  if (provider === "voyage") return embedVoyage(texts);
  throw new Error(`Unknown EMBEDDINGS_PROVIDER: ${provider}`);
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
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: texts,
      dimensions: TARGET_DIMENSIONS,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI embed failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
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
    body: JSON.stringify({ model: "voyage-3", input: texts, input_type: "document" }),
  });
  if (!res.ok) throw new Error(`Voyage embed failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
}
