import Link from "next/link";
import { EventGraphView } from "./graph-view";

export const metadata = { title: "Event · Graph" };

export default async function EventGraphPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="flex h-[calc(100svh-49px)] flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-panel/60 px-4 py-2 sm:px-6 sm:py-3">
        <div className="min-w-0">
          <Link
            href={`/events/${id}`}
            className="font-mono text-xs text-zinc-500 hover:text-accent"
          >
            ← Event
          </Link>
          <h1 className="truncate font-mono text-base font-semibold text-zinc-100 sm:text-lg">
            Knowledge graph
          </h1>
        </div>
        <div className="hidden font-mono text-xs text-zinc-500 md:block">
          Entities + relations · click a node
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <EventGraphView eventId={id} />
      </div>
    </div>
  );
}
