import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const supabase = supabaseAdmin();
    const [docRes, chunksRes] = await Promise.all([
      supabase.from("brain_documents").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("brain_chunks")
        .select("id,chunk_index,content,token_count,embedding")
        .eq("document_id", id)
        .order("chunk_index", { ascending: true }),
    ]);
    if (docRes.error) throw new Error(docRes.error.message);
    if (!docRes.data) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const chunks = (chunksRes.data ?? []).map((c) => ({
      id: c.id,
      chunkIndex: c.chunk_index,
      content: c.content,
      tokenCount: c.token_count,
      hasEmbedding: c.embedding != null,
    }));

    return NextResponse.json({ doc: docRes.data, chunks });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const supabase = supabaseAdmin();
    // brain_chunks has ON DELETE CASCADE on document_id.
    const { error } = await supabase.from("brain_documents").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
