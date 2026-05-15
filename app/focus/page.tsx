import { cachedOr } from "@/lib/cache/market-cache";
import { computeFocusPayload, type FocusPayload } from "@/lib/focus/payload";
import { FocusEventsList } from "./events-list";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TTL_SEC = 24 * 60 * 60;

type Regime = "calm" | "stress" | "panic";

const REGIME_TEXT: Record<Regime, string> = {
  calm: "text-sky-300",
  stress: "text-amber-300",
  panic: "text-neg",
};
const REGIME_BAR: Record<Regime, string> = {
  calm: "bg-sky-400",
  stress: "bg-amber-400",
  panic: "bg-neg",
};

export default async function FocusPage() {
  const { data, cached, updatedAt } = await cachedOr<FocusPayload>(
    "focus",
    TTL_SEC,
    () => computeFocusPayload(),
  );

  const haveTimeline = data.timeline.filter((v): v is number => v != null).length >= 10;
  const allEmpty = data.events.every((e) => e.score === 0 && e.proxyReturns.every((r) => r.ret1M == null));

  return (
    <main className="px-3 py-3">
      <PageHeader code="FOCUS" title="MACRO FOCUS" cached={cached} updatedAt={updatedAt} />

      {allEmpty && (
        <div className="mt-2 border border-neg/60 bg-neg/10 px-3 py-2 text-2xs uppercase tracking-widest text-neg">
          <span className="text-neg">⚠</span> NO MARKET DATA · every focus proxy returned
          empty. Check <span className="text-accent">MARKETSTACK_API_KEY</span> on Vercel and
          inspect <a className="text-accent underline" href="/health">/health</a>.
        </div>
      )}

      <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-4">
        <Panel code="P0" title="PRESSURE">
          <PressureBody value={data.pressureNow} delta={data.pressureDelta} regime={data.regime} />
        </Panel>
        <div className="xl:col-span-3">
          <Panel code="T1" title="PRESSURE · 90D TIMELINE">
            {haveTimeline ? (
              <TimelineSvg timeline={data.timeline} />
            ) : (
              <div className="flex h-32 items-center justify-center text-2xs uppercase text-zinc-600">
                NOT ENOUGH HISTORY
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <Bucket label="CALM" tone="calm" count={data.buckets.calm} total={data.total} />
        <Bucket label="STRESS" tone="stress" count={data.buckets.stress} total={data.total} />
        <Bucket label="PANIC" tone="panic" count={data.buckets.panic} total={data.total} />
      </div>

      <FocusEventsList events={data.events} />
    </main>
  );
}

function PageHeader({
  code,
  title,
  cached,
  updatedAt,
}: {
  code: string;
  title: string;
  cached: boolean;
  updatedAt: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border pb-1">
      <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
        {code}
      </span>
      <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">{title}</h1>
      <span className="ml-auto text-2xs uppercase tracking-widest text-zinc-600">
        {cached ? "CACHE" : "LIVE"}
        {updatedAt && (
          <span className="ml-2 text-zinc-700">· {new Date(updatedAt).toUTCString().slice(5, 22)}</span>
        )}
      </span>
    </div>
  );
}

function Panel({
  code,
  title,
  children,
}: {
  code: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-panel">
      <div className="flex items-center gap-2 border-b border-border bg-black/40 px-2 py-1">
        <span className="text-2xs font-bold uppercase tracking-widest text-accent">{code}</span>
        <span className="text-2xs font-medium uppercase tracking-widest text-zinc-300">{title}</span>
      </div>
      <div className="px-2 py-2">{children}</div>
    </div>
  );
}

function PressureBody({
  value,
  delta,
  regime,
}: {
  value: number;
  delta: number;
  regime: Regime;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-3xl tabular-nums text-accent">{value.toFixed(1)}</span>
        <span className="text-2xs uppercase text-zinc-500">/ 100</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-2xs uppercase tracking-widest">
        <span className={REGIME_TEXT[regime]}>{regime}</span>
        <span
          className={
            delta > 0
              ? "text-neg"
              : delta < 0
                ? "text-pos"
                : "text-zinc-500"
          }
        >
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)} Δ 90D
        </span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden bg-black">
        <div
          className={`h-full ${REGIME_BAR[regime]}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

function TimelineSvg({ timeline }: { timeline: Array<number | null> }) {
  const values = timeline.map((v, i) => ({ x: i, y: v }));
  const valid = values.filter((p): p is { x: number; y: number } => p.y != null);
  if (valid.length < 2) {
    return (
      <div className="flex h-32 items-center justify-center text-2xs uppercase text-zinc-600">
        NOT ENOUGH HISTORY
      </div>
    );
  }
  const W = 600;
  const H = 120;
  const xs = valid.map((p) => p.x);
  const ys = valid.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys, 0);
  const yMax = Math.max(...ys, 100);
  const sx = (x: number) =>
    xMax === xMin ? 0 : ((x - xMin) / (xMax - xMin)) * (W - 8) + 4;
  const sy = (y: number) =>
    yMax === yMin ? H / 2 : H - 4 - ((y - yMin) / (yMax - yMin)) * (H - 8);
  const d = valid
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`)
    .join(" ");
  const last = valid[valid.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" preserveAspectRatio="none">
      <line x1={0} x2={W} y1={sy(yMin)} y2={sy(yMin)} stroke="#262629" />
      <line x1={0} x2={W} y1={sy((yMin + yMax) / 2)} y2={sy((yMin + yMax) / 2)} stroke="#262629" strokeDasharray="2,3" />
      <line x1={0} x2={W} y1={sy(yMax)} y2={sy(yMax)} stroke="#262629" />
      <path d={d} fill="none" stroke="#f5a623" strokeWidth={1.5} />
      <circle cx={sx(last.x)} cy={sy(last.y)} r={2.5} fill="#f5a623" />
    </svg>
  );
}

function Bucket({
  label,
  tone,
  count,
  total,
}: {
  label: string;
  tone: Regime;
  count: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div className="border border-border bg-panel px-2 py-1">
      <div className="flex items-center justify-between">
        <span className={`text-2xs font-bold uppercase tracking-widest ${REGIME_TEXT[tone]}`}>
          {label}
        </span>
        <span className="font-mono text-lg tabular-nums text-zinc-100">{count}</span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden bg-black">
        <div className={`h-full ${REGIME_BAR[tone]}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-2xs uppercase tracking-widest text-zinc-500">
        {pct}% of {total}
      </div>
    </div>
  );
}
