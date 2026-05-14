import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type DocRow = {
  id: string;
  title: string;
  source_type: string;
  created_at: string;
  source_url: string | null;
  chunk_count: number;
  embedding: number[];
};

type Node = {
  id: string;
  label: string;
  group: string;
  val: number; // node size (number of chunks)
  url: string | null;
  createdAt: string;
};

type Link = {
  source: string;
  target: string;
  value: number; // similarity 0..1
};

const TOP_K_NEIGHBORS = 3;
const MIN_SIMILARITY = 0.55;

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Returns the document-similarity graph for the Second Brain.
 *
 * Each node is a brain_document. Each edge is a "this doc is semantically close
 * to that doc" relationship, computed from the average chunk embedding. We
 * keep only the top-K neighbors per node above MIN_SIMILARITY so the graph
 * stays sparse and readable.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 300), 1000);

  const supabase = supabaseAdmin();

  const { data: docs, error: docErr } = await supabase
    .from("brain_documents")
    .select("id,title,source_type,created_at,source_url")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });
  if (!docs || docs.length === 0) {
    return NextResponse.json({ ok: true, nodes: [], links: [] });
  }

  const docIds = docs.map((d) => d.id);

  const { data: chunks, error: chunkErr } = await supabase
    .from("brain_chunks")
    .select("document_id,embedding")
    .in("document_id", docIds)
    .not("embedding", "is", null);
  if (chunkErr) return NextResponse.json({ error: chunkErr.message }, { status: 500 });

  // Reduce each document to its average chunk embedding so similarity is
  // computed at document-level, not chunk-level.
  const docEmbeddings = new Map<string, { sum: number[]; count: number }>();
  for (const c of chunks ?? []) {
    const emb = parseEmbedding(c.embedding as unknown);
    if (!emb) continue;
    const cur = docEmbeddings.get(c.document_id) ?? {
      sum: new Array(emb.length).fill(0) as number[],
      count: 0,
    };
    for (let i = 0; i < emb.length; i++) cur.sum[i] += emb[i];
    cur.count += 1;
    docEmbeddings.set(c.document_id, cur);
  }

  const docVectors: DocRow[] = [];
  for (const d of docs) {
    const e = docEmbeddings.get(d.id);
    if (!e) continue;
    const avg = e.sum.map((s) => s / e.count);
    docVectors.push({
      ...d,
      chunk_count: e.count,
      embedding: avg,
    });
  }

  const nodes: Node[] = docVectors.map((d) => ({
    id: d.id,
    label: d.title.slice(0, 120),
    group: d.source_type,
    val: Math.max(2, Math.min(15, d.chunk_count)),
    url: d.source_url,
    createdAt: d.created_at,
  }));

  // For each doc, keep top-K most similar neighbors above the threshold.
  // We dedupe edges with a canonical sort so (a,b) and (b,a) collapse.
  const seen = new Set<string>();
  const links: Link[] = [];
  for (let i = 0; i < docVectors.length; i++) {
    const scored: Array<{ idx: number; sim: number }> = [];
    for (let j = 0; j < docVectors.length; j++) {
      if (i === j) continue;
      const sim = cosine(docVectors[i].embedding, docVectors[j].embedding);
      if (sim >= MIN_SIMILARITY) scored.push({ idx: j, sim });
    }
    scored.sort((a, b) => b.sim - a.sim);
    for (const s of scored.slice(0, TOP_K_NEIGHBORS)) {
      const a = docVectors[i].id;
      const b = docVectors[s.idx].id;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ source: a, target: b, value: s.sim });
    }
  }

  return NextResponse.json({ ok: true, nodes, links });
}

function parseEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw)) return raw as number[];
  // Supabase returns vector columns as a string like "[0.1,0.2,...]".
  if (typeof raw === "string") {
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : null;
    } catch {
      return null;
    }
  }
  return null;
}
