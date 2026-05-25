import { NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/health/checks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const report = await runHealthChecks();
  return NextResponse.json(report, { status: report.ok ? 200 : 503 });
}
