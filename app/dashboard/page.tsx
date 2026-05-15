import { DashboardClient, type DashboardPayload } from "./dashboard-client";
import { cachedOr } from "@/lib/cache/market-cache";
import { computeDashboardPayload } from "@/lib/dashboard/payload";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TTL_SEC = 24 * 60 * 60; // 1 day — GitHub Action refreshes ahead of this.

export default async function DashboardPage() {
  const { data, cached, updatedAt } = await cachedOr<DashboardPayload>(
    "dashboard",
    TTL_SEC,
    () => computeDashboardPayload(),
  );

  // Empty-data banner: when every ticker is missing the env is most likely
  // misconfigured (MARKETSTACK_API_KEY) or out of quota.
  const totalTickers = data.groups.reduce((n, g) => n + g.tickers.length, 0) + data.pulse.length;
  const dataMissing = data.errors.length >= Math.max(1, Math.floor(totalTickers * 0.5));

  return (
    <>
      {dataMissing && (
        <div className="mx-3 mt-2 border border-neg/60 bg-neg/10 px-3 py-2 text-2xs uppercase tracking-widest text-neg">
          <span className="text-neg">⚠</span> NO MARKET DATA · {data.errors.length}/{totalTickers}{" "}
          tickers empty. Likely <span className="text-accent">MARKETSTACK_API_KEY</span>{" "}
          missing/invalid on Vercel, or daily quota exhausted. Open{" "}
          <a className="text-accent underline" href="/health">
            /health
          </a>{" "}
          for diagnostics.
        </div>
      )}
      <DashboardClient
        payload={data}
        meta={{ cached, updatedAt, source: cached ? "cache" : "live" }}
      />
    </>
  );
}
