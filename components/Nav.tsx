import Link from "next/link";

const items = [
  { href: "/", label: "Home" },
  { href: "/brain", label: "Brain" },
  { href: "/markets", label: "Markets" },
  { href: "/events", label: "Events" },
];

export function Nav() {
  return (
    <nav className="border-b border-border bg-panel/50 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3 text-sm">
        <Link href="/" className="font-semibold text-accent">
          NEVIS
        </Link>
        {items.slice(1).map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="text-zinc-400 transition hover:text-zinc-100"
          >
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
