import { DashboardClient, type DashboardPayload } from "./dashboard-client";
import { cachedOr } from "@/lib/cache/market-cache";
import { computeDashboardPayload } from "@/lib/dashboard/payload";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TTL_SEC = 24 * 60 * 60; // 1 day — GitHub Action refreshes ahead of this.

export default async function DashboardPage() {
  // Cache-first: serve the GitHub-Action snapshot when warm, fall back to a
  // live MarketStack fetch + write-through when cold or older than 24h.
  const { data, cached, updatedAt } = await cachedOr<DashboardPayload>(
    "dashboard",
    TTL_SEC,
    () => computeDashboardPayload(),
  );

  return (
    <DashboardClient
      payload={data}
      meta={{ cached, updatedAt, source: cached ? "cache" : "live" }}
    />
  );
}
