import Link from "next/link";

const items = [
  { href: "/brain", label: "Brain" },
  { href: "/brain/graph", label: "Graph" },
  { href: "/markets", label: "Markets" },
  { href: "/events", label: "Events" },
  { href: "/reports", label: "Reports" },
];

export function Nav() {
  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-panel/70 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 text-sm sm:gap-6 sm:px-6">
        <Link href="/" className="shrink-0 font-semibold text-accent">
          NEVIS
        </Link>
        <div className="flex flex-1 items-center gap-3 overflow-x-auto sm:gap-5">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="shrink-0 text-zinc-400 transition hover:text-zinc-100"
            >
              {it.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
