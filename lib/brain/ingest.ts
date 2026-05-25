import { supabaseAdmin } from "@/lib/supabase/server";
import { chunkText, estimateTokens } from "./chunker";
import { embed } from "./embeddings";
import { enrichDocument } from "./enrich";
import { contentHash } from "./hash";

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
  deduped: boolean;
  enriched: boolean;
};

/**
 * Persist a document, chunk it, compute embeddings, enrich with AI metadata,
 * and store everything. Designed to be called either from API routes (small
 * docs) or Inngest steps (large docs).
 *
 * Skips the heavy work if a doc with the same content_hash already exists —
 * we still return its id so callers can link to it, but no chunks / embeddings
 * / OpenAI calls are issued.
 */
export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  const supabase = supabaseAdmin();

  const hash = contentHash(input.rawText);

  const { data: existing } = await supabase
    .from("brain_documents")
    .select("id")
    .eq("content_hash", hash)
    .maybeSingle();

  if (existing?.id) {
    return { documentId: existing.id, chunkCount: 0, deduped: true, enriched: false };
  }

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
      content_hash: hash,
    })
    .select("id")
    .single();
  if (docErr || !doc) throw new Error(`brain_documents insert failed: ${docErr?.message}`);

  const chunks = chunkText(input.rawText);
  if (chunks.length > 0) {
    const embeddings = await embed(chunks);
    const rows = chunks.map((content, i) => ({
      document_id: doc.id,
      chunk_index: i,
      content,
      embedding: embeddings[i] as unknown as string,
      token_count: estimateTokens(content),
      metadata: {},
    }));
    const { error: chunkErr } = await supabase.from("brain_chunks").insert(rows);
    if (chunkErr) throw new Error(`brain_chunks insert failed: ${chunkErr.message}`);
  }

  // Enrichment is best-effort: if OpenAI hiccups or the doc is too weird to
  // classify, we keep the doc anyway and let the /admin/enrich backfill route
  // pick it up later.
  let enriched = false;
  try {
    const meta = await enrichDocument({
      title: input.title,
      rawText: input.rawText,
      sourceType: input.sourceType,
    });
    const { error: updErr } = await supabase
      .from("brain_documents")
      .update({
        summary: meta.summary || null,
        entities: meta.entities,
        topics: meta.topics,
        sentiment: meta.sentiment,
        enriched_at: new Date().toISOString(),
      })
      .eq("id", doc.id);
    if (!updErr) enriched = true;
  } catch {
    // swallow — backfill will retry
  }

  return {
    documentId: doc.id,
    chunkCount: chunks.length,
    deduped: false,
    enriched,
  };
}
