import Link from "next/link";
import { Clock } from "./Clock";

const KEYS: Array<{ k: string; href: string; label: string }> = [
  { k: "1", href: "/dashboard", label: "DASH" },
  { k: "2", href: "/focus", label: "FOCUS" },
  { k: "3", href: "/charts", label: "CHRT" },
  { k: "4", href: "/brain", label: "BRN" },
  { k: "5", href: "/brain/graph", label: "GRPH" },
  { k: "6", href: "/markets", label: "MKTS" },
  { k: "7", href: "/events", label: "EVT" },
  { k: "8", href: "/reports", label: "REP" },
];

export function CommandBar() {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-accent/60 bg-black px-3 py-1.5 text-2xs">
      <Link
        href="/"
        className="flex items-center gap-1 font-bold uppercase tracking-[0.25em] text-accent"
      >
        <span className="text-pos">●</span> NEVIS
      </Link>
      <nav className="flex flex-1 items-center gap-3 overflow-x-auto">
        {KEYS.map((k) => (
          <Link
            key={k.href}
            href={k.href}
            className="group flex shrink-0 items-center gap-1 uppercase tracking-wider text-zinc-400 hover:text-accent"
          >
            <span className="text-accent">{k.k})</span>
            <span className="group-hover:text-accent">{k.label}</span>
          </Link>
        ))}
      </nav>
      <div className="flex shrink-0 items-center gap-3 uppercase tracking-wider text-zinc-500">
        <span className="hidden sm:inline">TERMINAL</span>
        <Clock />
      </div>
    </header>
  );
}
