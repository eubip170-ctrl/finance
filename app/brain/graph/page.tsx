import Link from "next/link";
import { GraphView } from "./graph-view";

export const metadata = { title: "Brain · Graph" };

export default function BrainGraphPage() {
  return (
    <div className="flex h-[calc(100svh-49px)] flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-panel/60 px-4 py-2 sm:px-6 sm:py-3">
        <div className="min-w-0">
          <Link href="/brain" className="text-xs text-zinc-500 hover:text-accent">
            ← Brain
          </Link>
          <h1 className="truncate text-base font-semibold text-zinc-100 sm:text-lg">
            Knowledge graph
          </h1>
        </div>
        <div className="hidden text-xs text-zinc-500 md:block">
          Drag to rotate · Scroll to zoom · Click a node
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <GraphView />
      </div>
    </div>
  );
}
