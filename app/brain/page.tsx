import Link from "next/link";
import { BrainClient } from "./brain-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function BrainPage() {
  return (
    <main className="px-3 py-3">
      <div className="flex items-center gap-3 border-b border-border pb-1">
        <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
          BRN
        </span>
        <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">
          SECOND BRAIN
        </h1>
        <Link
          href="/brain/graph"
          className="ml-auto border border-accent/60 px-2 py-0.5 text-2xs uppercase tracking-widest text-accent hover:bg-accent/10"
        >
          GRPH →
        </Link>
      </div>
      <BrainClient />
    </main>
  );
}
