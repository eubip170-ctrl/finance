import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { pca3 } from "@/lib/brain/pca";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const MAX_CHUNKS = 2000;

type ChunkRow = {
  id: string;
  document_id: string;
  content: string;
  embedding: number[] | string;
};

type DocRow = {
  id: string;
  title: string;
  source_type: string;
};

/**
 * Returns the 3D PCA projection of all chunk embeddings, joined with the
 * parent document's title and source_type. Used by the /brain 3D viz.
 *
 * Embeddings come back from Supabase as a string in pgvector text format
 * (e.g. "[0.1,0.2,...]"); we parse them on the server before running PCA so
 * the client only sees the small projected payload.
 */
export async function GET() {
  try {
    const supabase = supabaseAdmin();

    const { data: chunks, error: chunkErr } = await supabase
      .from("brain_chunks")
      .select("id,document_id,content,embedding")
      .limit(MAX_CHUNKS);
    if (chunkErr) throw chunkErr;

    const rows = (chunks ?? []) as ChunkRow[];
    if (rows.length === 0) {
      return NextResponse.json({
        points: [],
        sourceTypes: [],
        truncated: false,
        total: 0,
      });
    }

    const docIds = Array.from(new Set(rows.map((r) => r.document_id)));
    const { data: docs, error: docErr } = await supabase
      .from("brain_documents")
      .select("id,title,source_type")
      .in("id", docIds);
    if (docErr) throw docErr;

    const docMap = new Map<string, DocRow>(
      (docs ?? []).map((d: DocRow) => [d.id, d]),
    );

    const vectors: number[][] = [];
    const meta: Array<{
      id: string;
      title: string;
      source: string;
      snippet: string;
    }> = [];

    for (const r of rows) {
      const v = parseEmbedding(r.embedding);
      if (!v) continue;
      vectors.push(v);
      const doc = docMap.get(r.document_id);
      meta.push({
        id: r.id,
        title: doc?.title ?? "(untitled)",
        source: doc?.source_type ?? "unknown",
        snippet: r.content.slice(0, 240),
      });
    }

    if (vectors.length === 0) {
      return NextResponse.json({
        points: [],
        sourceTypes: [],
        truncated: false,
        total: 0,
      });
    }

    const { projections } = pca3(vectors);

    // Normalise projections to a stable [-1, 1] cube so the camera defaults
    // work regardless of the embedding model's variance scale.
    const flat = projections.flat();
    let maxAbs = 0;
    for (const x of flat) if (Math.abs(x) > maxAbs) maxAbs = Math.abs(x);
    const scale = maxAbs > 1e-9 ? 1 / maxAbs : 1;

    const points = projections.map((p, i) => ({
      id: meta[i].id,
      title: meta[i].title,
      source: meta[i].source,
      snippet: meta[i].snippet,
      x: p[0] * scale,
      y: p[1] * scale,
      z: p[2] * scale,
    }));

    const sourceTypes = Array.from(new Set(points.map((p) => p.source))).sort();

    return NextResponse.json({
      points,
      sourceTypes,
      truncated: rows.length >= MAX_CHUNKS,
      total: points.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

function parseEmbedding(raw: number[] | string): number[] | null {
  if (Array.isArray(raw)) {
    return raw.every((n) => typeof n === "number" && Number.isFinite(n))
      ? raw
      : null;
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;
  try {
    const arr = JSON.parse(trimmed) as unknown[];
    if (!Array.isArray(arr)) return null;
    const out: number[] = [];
    for (const x of arr) {
      const n = typeof x === "number" ? x : parseFloat(String(x));
      if (!Number.isFinite(n)) return null;
      out.push(n);
    }
    return out;
  } catch {
    return null;
  }
}
