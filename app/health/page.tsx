import Link from "next/link";
import { MarketstackProbe } from "./marketstack-probe";

async function loadHealth(): Promise<HealthReport | null> {
  try {
    const base =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const res = await fetch(`${base}/api/health`, { cache: "no-store" });
    return (await res.json()) as HealthReport;
  } catch {
    return null;
  }
}

interface Check {
  ok: boolean;
  detail?: string;
  ms?: number;
}
interface HealthReport {
  ok: boolean;
  env: Record<string, Check>;
  supabase: Check;
  marketstack: Check;
  cache: Record<string, Check>;
  ts: string;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HealthPage() {
  const h = await loadHealth();

  if (!h) {
    return (
      <main className="px-3 py-3">
        <PageHeader title="SYSTEM HEALTH" />
        <div className="mt-2 border border-neg/60 bg-neg/10 px-2 py-1 text-2xs uppercase text-neg">
          Could not reach /api/health. Visit /api/health directly to debug.
        </div>
      </main>
    );
  }

  return (
    <main className="px-3 py-3">
      <PageHeader title="SYSTEM HEALTH" ok={h.ok} ts={h.ts} />

      <Section code="E" title="ENV VARS">
        <ChecksTable checks={h.env} />
      </Section>

      <Section code="S" title="SUPABASE">
        <CheckRow label="market_cache reachable" check={h.supabase} />
      </Section>

      <Section code="M" title="MARKETSTACK">
        <CheckRow label="GET /v2/eod?symbols=SPY" check={h.marketstack} />
        {!h.marketstack.ok && (
          <p className="mt-2 text-2xs uppercase text-zinc-500">
            Set <code className="text-accent">MARKETSTACK_API_KEY</code> on Vercel project
            env vars, then redeploy. v2 EOD requires a paid plan or an active free key.
          </p>
        )}
      </Section>

      <Section code="MP" title="MARKETSTACK PROBE">
        <MarketstackProbe />
      </Section>

      <Section code="C" title="CACHE SNAPSHOTS">
        <ChecksTable checks={h.cache} />
        {Object.values(h.cache).some((c) => !c.ok) && (
          <p className="mt-2 text-2xs uppercase text-zinc-500">
            Snapshots are written by{" "}
            <code className="text-accent">/api/cron/refresh-market</code> daily. Trigger it
            manually from GitHub Actions or with{" "}
            <code className="text-accent">
              curl -XPOST -H &quot;Authorization: Bearer $CRON_SECRET&quot; .../api/cron/refresh-market
            </code>
            .
          </p>
        )}
      </Section>

      <div className="mt-2 text-2xs uppercase tracking-widest text-zinc-600">
        Raw JSON →{" "}
        <Link className="text-accent hover:underline" href="/api/health">
          /api/health
        </Link>
        {" · "}
        <Link className="text-accent hover:underline" href="/api/health/marketstack">
          /api/health/marketstack
        </Link>
      </div>
    </main>
  );
}

function PageHeader({ title, ok, ts }: { title: string; ok?: boolean; ts?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border pb-1">
      <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
        HLTH
      </span>
      <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">{title}</h1>
      {typeof ok === "boolean" && (
        <span
          className={`ml-auto text-2xs uppercase tracking-widest ${
            ok ? "text-pos" : "text-neg"
          }`}
        >
          {ok ? "OK" : "DEGRADED"}
          {ts && <span className="ml-2 text-zinc-700">· {ts}</span>}
        </span>
      )}
    </div>
  );
}

function Section({
  code,
  title,
  children,
}: {
  code: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-2 border border-border bg-panel">
      <div className="flex items-center gap-2 border-b border-border bg-black/40 px-2 py-1">
        <span className="text-2xs font-bold uppercase tracking-widest text-accent">{code}</span>
        <span className="text-2xs font-medium uppercase tracking-widest text-zinc-300">
          {title}
        </span>
      </div>
      <div className="px-2 py-2">{children}</div>
    </section>
  );
}

function ChecksTable({ checks }: { checks: Record<string, Check> }) {
  return (
    <table className="w-full font-mono text-2xs tabular-nums">
      <tbody>
        {Object.entries(checks).map(([k, c]) => (
          <CheckRow key={k} label={k} check={c} />
        ))}
      </tbody>
    </table>
  );
}

function CheckRow({ label, check }: { label: string; check: Check }) {
  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="w-6 px-2 py-1">
        <span
          className={`inline-block h-2 w-2 rounded-full ${check.ok ? "bg-pos" : "bg-neg"}`}
        />
      </td>
      <td className="px-2 py-1 text-zinc-300">{label}</td>
      <td className="px-2 py-1 text-zinc-500">{check.detail ?? "—"}</td>
      <td className="px-2 py-1 text-right text-zinc-600">
        {check.ms != null ? `${check.ms}ms` : ""}
      </td>
    </tr>
  );
}
