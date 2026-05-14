import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { kmeans, chooseK } from "@/lib/brain/kmeans";
import { MODELS, completeJSON } from "@/lib/llm/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Node = {
  id: string;
  label: string;
  source: string;
  cluster: number;
  val: number;
  url: string | null;
  createdAt: string;
};
type Link = { source: string; target: string; value: number };
type Cluster = { id: number; label: string; topics: string[]; size: number };

const TOP_K_NEIGHBORS = 5;
const MIN_SIMILARITY = 0.4;
const K_MIN = 3;
const K_MAX = 8;

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

function parseEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw)) return raw as number[];
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

function clusterSignature(titlesByCluster: string[][]): string[] {
  // Deterministic content signature per cluster (first 3 titles, sorted) so
  // labels are cached and don't re-cost LLM tokens on every render.
  return titlesByCluster.map((titles) => {
    const t = [...titles].sort().slice(0, 3).join(" | ").slice(0, 300);
    return t || "empty";
  });
}

async function labelClusters(
  titlesByCluster: string[][],
): Promise<Array<{ label: string; topics: string[] }>> {
  const supabase = supabaseAdmin();
  const signatures = clusterSignature(titlesByCluster);

  // Try cache first.
  const { data: cached } = await supabase
    .from("brain_cluster_labels")
    .select("signature,label,topics")
    .in("signature", signatures);
  const cachedMap = new Map(
    (cached ?? []).map((c) => [c.signature, { label: c.label, topics: c.topics ?? [] }]),
  );

  const out: Array<{ label: string; topics: string[] }> = new Array(titlesByCluster.length);
  const toGenerate: number[] = [];
  for (let i = 0; i < signatures.length; i++) {
    const hit = cachedMap.get(signatures[i]);
    if (hit) out[i] = hit;
    else toGenerate.push(i);
  }

  if (toGenerate.length === 0) return out;

  try {
    const prompt = `For each of these clusters of macro / financial / geopolitical news titles, output a short label and 2-4 topic keywords. Be concise and specific (e.g. "ECB monetary policy", not "central banks").

${toGenerate
  .map((idx) => {
    const titles = titlesByCluster[idx].slice(0, 8);
    return `Cluster ${idx}:\n- ${titles.join("\n- ")}`;
  })
  .join("\n\n")}

Return strictly JSON:
{
  "clusters": [
    { "id": <cluster_index>, "label": "<≤40 chars>", "topics": ["...", "..."] }
  ]
}`;

    const res = await completeJSON<{
      clusters: Array<{ id: number; label: string; topics: string[] }>;
    }>({
      model: MODELS.fast,
      system:
        "You label clusters of financial news. Keep labels short and analyst-friendly.",
      prompt,
      maxTokens: 800,
      temperature: 0.2,
    });

    const rows: Array<{ signature: string; label: string; topics: string[] }> = [];
    for (const c of res.clusters ?? []) {
      if (typeof c.id !== "number" || !titlesByCluster[c.id]) continue;
      const cleaned = {
        label: (c.label ?? "Cluster").slice(0, 60),
        topics: Array.isArray(c.topics) ? c.topics.slice(0, 4).map((t) => String(t)) : [],
      };
      out[c.id] = cleaned;
      rows.push({ signature: signatures[c.id], ...cleaned });
    }
    if (rows.length > 0) {
      await supabase.from("brain_cluster_labels").upsert(rows, { onConflict: "signature" });
    }
  } catch (err) {
    console.error("cluster labelling failed:", err);
  }

  for (let i = 0; i < out.length; i++) {
    if (!out[i]) out[i] = { label: `Cluster ${i + 1}`, topics: [] };
  }
  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 400), 1500);
  const skipLabels = searchParams.get("labels") === "false";

  const supabase = supabaseAdmin();

  const { data: docs, error: docErr } = await supabase
    .from("brain_documents")
    .select("id,title,source_type,created_at,source_url")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });
  if (!docs || docs.length === 0) {
    return NextResponse.json({ ok: true, nodes: [], links: [], clusters: [] });
  }

  const docIds = docs.map((d) => d.id);
  const { data: chunks, error: chunkErr } = await supabase
    .from("brain_chunks")
    .select("document_id,embedding")
    .in("document_id", docIds)
    .not("embedding", "is", null);
  if (chunkErr) return NextResponse.json({ error: chunkErr.message }, { status: 500 });

  const accum = new Map<string, { sum: number[]; count: number }>();
  for (const c of chunks ?? []) {
    const emb = parseEmbedding(c.embedding as unknown);
    if (!emb) continue;
    const cur = accum.get(c.document_id) ?? {
      sum: new Array(emb.length).fill(0) as number[],
      count: 0,
    };
    for (let i = 0; i < emb.length; i++) cur.sum[i] += emb[i];
    cur.count += 1;
    accum.set(c.document_id, cur);
  }

  const items: Array<{
    id: string;
    title: string;
    source: string;
    url: string | null;
    createdAt: string;
    chunkCount: number;
    vec: number[];
  }> = [];
  for (const d of docs) {
    const a = accum.get(d.id);
    if (!a) continue;
    const v = a.sum.map((s) => s / a.count);
    items.push({
      id: d.id,
      title: d.title,
      source: d.source_type,
      url: d.source_url,
      createdAt: d.created_at,
      chunkCount: a.count,
      vec: v,
    });
  }

  if (items.length === 0) {
    return NextResponse.json({ ok: true, nodes: [], links: [], clusters: [] });
  }

  const vectors = items.map((it) => it.vec);
  const k = chooseK(vectors, K_MIN, K_MAX);
  const { assignments } = kmeans(vectors, k, { seed: 11, maxIter: 40 });

  const titlesByCluster: string[][] = Array.from({ length: k }, () => []);
  for (let i = 0; i < items.length; i++) {
    titlesByCluster[assignments[i]].push(items[i].title);
  }

  const clusterMeta = skipLabels
    ? titlesByCluster.map((_, i) => ({ label: `Cluster ${i + 1}`, topics: [] as string[] }))
    : await labelClusters(titlesByCluster);

  const clusters: Cluster[] = clusterMeta.map((c, i) => ({
    id: i,
    label: c.label,
    topics: c.topics,
    size: titlesByCluster[i].length,
  }));

  const nodes: Node[] = items.map((it, i) => ({
    id: it.id,
    label: it.title.slice(0, 140),
    source: it.source,
    cluster: assignments[i],
    val: Math.max(2, Math.min(15, it.chunkCount)),
    url: it.url,
    createdAt: it.createdAt,
  }));

  const seen = new Set<string>();
  const links: Link[] = [];
  for (let i = 0; i < items.length; i++) {
    const scored: Array<{ j: number; sim: number }> = [];
    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const sim = cosine(items[i].vec, items[j].vec);
      if (sim >= MIN_SIMILARITY) scored.push({ j, sim });
    }
    scored.sort((a, b) => b.sim - a.sim);
    for (const s of scored.slice(0, TOP_K_NEIGHBORS)) {
      const a = items[i].id;
      const b = items[s.j].id;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ source: a, target: b, value: s.sim });
    }
  }

  return NextResponse.json({ ok: true, nodes, links, clusters });
}
