import { supabaseAdmin } from "@/lib/supabase/server";
import { embed } from "./embeddings";

export type RetrievedChunk = {
  id: string;
  documentId: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
};

export type RetrieveOptions = {
  matchCount?: number;
  minSimilarity?: number;
  filterSource?: string | null;
};

export async function retrieve(
  query: string,
  opts: RetrieveOptions = {},
): Promise<RetrievedChunk[]> {
  const supabase = supabaseAdmin();
  const [vec] = await embed(query);
  if (!vec) return [];

  const { data, error } = await supabase.rpc("match_brain_chunks", {
    query_embedding: vec as unknown as string,
    match_count: opts.matchCount ?? 8,
    min_similarity: opts.minSimilarity ?? 0.25,
    filter_source: opts.filterSource ?? null,
  });
  if (error) throw new Error(`match_brain_chunks failed: ${error.message}`);

  return (data ?? []).map((r: {
    id: string;
    document_id: string;
    content: string;
    similarity: number;
    metadata: Record<string, unknown>;
  }) => ({
    id: r.id,
    documentId: r.document_id,
    content: r.content,
    similarity: r.similarity,
    metadata: r.metadata,
  }));
}
