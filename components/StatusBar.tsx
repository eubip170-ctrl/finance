export function StatusBar() {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-4 border-t border-border bg-black px-3 py-1 text-[10px] uppercase tracking-wider">
      <span className="flex items-center gap-1 text-pos">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-pos" />
        LIVE
      </span>
      <span className="text-zinc-500">env: prod</span>
      <span className="text-zinc-500">rss: 30m</span>
      <span className="text-zinc-500">studier: 4h</span>
      <a
        href="/health"
        className="text-zinc-500 transition hover:text-accent"
        title="System diagnostics"
      >
        health
      </a>
      <span className="ml-auto text-zinc-600">NEVIS · macro terminal</span>
    </footer>
  );
}
