import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const source = url.searchParams.get("source") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const cursor = Number(url.searchParams.get("cursor") ?? 0) || 0;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? PAGE_SIZE) || PAGE_SIZE, 100);

  try {
    const supabase = supabaseAdmin();
    let qb = supabase
      .from("brain_documents")
      .select("id,title,source_type,source_url,author,published_at,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(cursor, cursor + limit - 1);

    if (q) qb = qb.ilike("title", `%${q}%`);
    if (source) qb = qb.eq("source_type", source);
    if (from) qb = qb.gte("created_at", from);
    if (to) qb = qb.lte("created_at", to);

    const { data, error, count } = await qb;
    if (error) throw new Error(error.message);

    return NextResponse.json({
      docs: data ?? [],
      total: count ?? 0,
      cursor,
      nextCursor: (data?.length ?? 0) === limit ? cursor + limit : null,
      pageSize: limit,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
