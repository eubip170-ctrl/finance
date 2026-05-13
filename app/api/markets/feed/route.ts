import { NextResponse } from "next/server";
import { fetchAllFeeds } from "@/lib/markets/rss";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET() {
  try {
    const items = await fetchAllFeeds();
    return NextResponse.json({ ok: true, count: items.length, items: items.slice(0, 100) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
