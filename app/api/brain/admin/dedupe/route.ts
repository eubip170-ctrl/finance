import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Identify documents that share the same `source_url` (case-insensitive on the
 * host + path, ignoring trailing slashes and query strings). When `apply` is
 * true, keep the oldest doc and delete the duplicates (and their chunks via
 * the ON DELETE CASCADE on brain_chunks.document_id).
 */

type DocRow = {
  id: string;
  title: string;
  source_url: string | null;
  created_at: string;
};

function normaliseUrl(u: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    return `${url.host.toLowerCase()}${path}`;
  } catch {
    return u.trim().toLowerCase() || null;
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const apply = Boolean(body?.apply);
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("brain_documents")
      .select("id,title,source_url,created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows: DocRow[] = (data ?? []) as DocRow[];
    const byKey = new Map<string, DocRow[]>();
    for (const r of rows) {
      const k = normaliseUrl(r.source_url);
      if (!k) continue;
      const bucket = byKey.get(k) ?? [];
      bucket.push(r);
      byKey.set(k, bucket);
    }

    const groups: Array<{ key: string; keeper: DocRow; duplicates: DocRow[] }> = [];
    for (const [key, bucket] of byKey.entries()) {
      if (bucket.length <= 1) continue;
      // Oldest stays (already sorted asc by created_at).
      const [keeper, ...duplicates] = bucket;
      groups.push({ key, keeper, duplicates });
    }

    const duplicateIds = groups.flatMap((g) => g.duplicates.map((d) => d.id));

    if (apply && duplicateIds.length > 0) {
      const { error: delErr } = await supabase
        .from("brain_documents")
        .delete()
        .in("id", duplicateIds);
      if (delErr) throw new Error(delErr.message);
    }

    return NextResponse.json({
      ok: true,
      applied: apply,
      duplicateGroupCount: groups.length,
      duplicateDocCount: duplicateIds.length,
      sampleGroups: groups.slice(0, 25).map((g) => ({
        key: g.key,
        keeper: { id: g.keeper.id, title: g.keeper.title, created_at: g.keeper.created_at },
        duplicates: g.duplicates.map((d) => ({
          id: d.id,
          title: d.title,
          created_at: d.created_at,
        })),
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
