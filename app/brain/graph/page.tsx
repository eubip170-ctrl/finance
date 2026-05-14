import Link from "next/link";
import { GraphView } from "./graph-view";

export const metadata = { title: "Brain · Graph" };

export default function BrainGraphPage() {
  return (
    <div className="flex h-[calc(100vh-49px)] flex-col">
      <header className="flex items-center justify-between border-b border-border bg-panel/60 px-6 py-3">
        <div>
          <Link href="/brain" className="text-xs text-zinc-500 hover:text-accent">
            ← Brain
          </Link>
          <h1 className="text-lg font-semibold text-zinc-100">Knowledge graph</h1>
        </div>
        <div className="text-xs text-zinc-500">
          Drag to rotate · Scroll to zoom · Click a node
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <GraphView />
      </div>
    </div>
  );
}
