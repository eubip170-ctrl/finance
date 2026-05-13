import Link from "next/link";
import { getQuotes } from "@/lib/markets/yahoo";
import { fetchAllFeeds } from "@/lib/markets/rss";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const WATCHLIST = ["^GSPC", "^STOXX50E", "^N225", "DX-Y.NYB", "GC=F", "CL=F", "BTC-USD"];

export default async function MarketsPage() {
  const [quotes, feed] = await Promise.allSettled([
    getQuotes(WATCHLIST),
    fetchAllFeeds(),
  ]);

  const quoteList = quotes.status === "fulfilled" ? quotes.value : [];
  const feedList = feed.status === "fulfilled" ? feed.value.slice(0, 20) : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Home
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">Markets</h1>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-400">
          Watchlist
        </h2>
        {quotes.status === "rejected" ? (
          <p className="text-sm text-red-400">Yahoo error: {String(quotes.reason)}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {quoteList.map((q) => (
              <li key={q.symbol} className="rounded border border-border bg-panel p-3">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  {q.symbol}
                </div>
                <div className="text-zinc-100">
                  {q.regularMarketPrice?.toFixed(2) ?? "—"}
                </div>
                <div
                  className={`text-xs ${
                    (q.regularMarketChangePercent ?? 0) >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {q.regularMarketChangePercent?.toFixed(2) ?? "0"}%
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-400">
          Recent news
        </h2>
        {feed.status === "rejected" ? (
          <p className="text-sm text-red-400">Feed error: {String(feed.reason)}</p>
        ) : (
          <ul className="space-y-2">
            {feedList.map((it) => (
              <li key={it.guid ?? it.link} className="rounded border border-border bg-panel p-3">
                <a
                  href={it.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-100 hover:text-accent"
                >
                  {it.title}
                </a>
                <div className="mt-1 text-xs text-zinc-500">
                  {it.feedName} · {it.isoDate ? new Date(it.isoDate).toLocaleString() : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
