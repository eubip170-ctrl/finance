export default function DashboardLoading() {
  return (
    <main className="px-3 py-3">
      <div className="flex items-center gap-3 border-b border-border pb-1">
        <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
          DASH
        </span>
        <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">
          MARKET DASHBOARD
        </h1>
        <span className="ml-auto text-2xs uppercase tracking-widest text-zinc-500">
          <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          LOADING
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 border border-border bg-panel px-2 py-1.5">
        <span className="text-2xs uppercase tracking-widest text-zinc-500">PERIOD</span>
        {["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y"].map((p) => (
          <span
            key={p}
            className="border border-border bg-black/40 px-2 py-0.5 text-2xs uppercase tracking-widest text-zinc-700"
          >
            {p}
          </span>
        ))}
        <span className="ml-auto text-2xs uppercase tracking-widest text-zinc-600">
          Warming up market cache… first hit can take ~30s when cold.
        </span>
      </div>

      <SkeletonSection code="P1" title="CROSS-ASSET PULSE">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
          {Array.from({ length: 13 }).map((_, i) => (
            <SkeletonBlock key={i} h="h-14" />
          ))}
        </div>
      </SkeletonSection>

      <SkeletonSection code="MC" title="MARKET CONTEXT">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} h="h-12" />
          ))}
        </div>
      </SkeletonSection>

      <SkeletonSection code="N1" title="NEWS WIRE">
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5">
              <div className="h-3 w-16 animate-pulse bg-zinc-800" />
              <div className="h-3 flex-1 animate-pulse bg-zinc-800" />
              <div className="h-3 w-10 animate-pulse bg-zinc-800" />
            </div>
          ))}
        </div>
      </SkeletonSection>

      <SkeletonSection code="M1" title="TOP MOVERS">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <SkeletonBlock h="h-48" />
          <SkeletonBlock h="h-48" />
        </div>
      </SkeletonSection>

      <SkeletonSection code="X1" title="PERFORMANCE MATRIX">
        <SkeletonBlock h="h-64" />
      </SkeletonSection>

      <SkeletonSection code="T1" title="RELATIVE PERFORMANCE TRACKERS">
        <div className="grid gap-2 grid-cols-1 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} h="h-44" />
          ))}
        </div>
      </SkeletonSection>
    </main>
  );
}

function SkeletonSection({
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
        <span className="ml-auto text-2xs uppercase tracking-widest text-zinc-700">loading…</span>
      </div>
      <div className="px-2 py-2">{children}</div>
    </section>
  );
}

function SkeletonBlock({ h }: { h: string }) {
  return <div className={`${h} animate-pulse border border-border bg-black/30`} />;
}
