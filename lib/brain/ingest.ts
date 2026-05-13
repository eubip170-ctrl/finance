import { supabaseAdmin } from "@/lib/supabase/server";
import { chunkText, estimateTokens } from "./chunker";
import { embed } from "./embeddings";

export type IngestInput = {
  sourceType:
    | "news"
    | "rss"
    | "pdf"
    | "manual"
    | "sim_output"
    | "market_note"
    | "transcript";
  title: string;
  rawText: string;
  sourceUrl?: string;
  author?: string;
  publishedAt?: string;
  metadata?: Record<string, unknown>;
};

export type IngestResult = {
  documentId: string;
  chunkCount: number;
};

/**
 * Persist a document, chunk it, compute embeddings, and store everything.
 * Designed to be called either from API routes (small docs) or Inngest steps (large docs).
 */
export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  const supabase = supabaseAdmin();

  const { data: doc, error: docErr } = await supabase
    .from("brain_documents")
    .insert({
      source_type: input.sourceType,
      source_url: input.sourceUrl ?? null,
      title: input.title,
      author: input.author ?? null,
      published_at: input.publishedAt ?? null,
      raw_text: input.rawText,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();
  if (docErr || !doc) throw new Error(`brain_documents insert failed: ${docErr?.message}`);

  const chunks = chunkText(input.rawText);
  if (chunks.length === 0) return { documentId: doc.id, chunkCount: 0 };

  const embeddings = await embed(chunks);

  const rows = chunks.map((content, i) => ({
    document_id: doc.id,
    chunk_index: i,
    content,
    embedding: embeddings[i] as unknown as string, // supabase-js accepts number[] for vector
    token_count: estimateTokens(content),
    metadata: {},
  }));

  const { error: chunkErr } = await supabase.from("brain_chunks").insert(rows);
  if (chunkErr) throw new Error(`brain_chunks insert failed: ${chunkErr.message}`);

  return { documentId: doc.id, chunkCount: chunks.length };
}
