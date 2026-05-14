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
  const feedList = feed.status === "fulfilled" ? feed.value.slice(0, 24) : [];

  return (
    <main className="px-3 py-3">
      <div className="flex items-center gap-3 border-b border-border pb-1">
        <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
          MKTS
        </span>
        <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">MARKETS</h1>
      </div>

      <div className="mt-2 border border-border bg-panel">
        <div className="flex items-center gap-2 border-b border-border bg-black/40 px-2 py-1">
          <span className="text-2xs font-bold uppercase tracking-widest text-accent">W1</span>
          <span className="text-2xs font-medium uppercase tracking-widest text-zinc-300">WATCHLIST</span>
        </div>
        <div className="px-2 py-2">
          {quotes.status === "rejected" ? (
            <p className="text-2xs uppercase text-neg">yahoo error: {String(quotes.reason)}</p>
          ) : quoteList.length === 0 ? (
            <p className="text-2xs uppercase text-zinc-600">yahoo rate-limited · retry ~1m</p>
          ) : (
            <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
              {quoteList.map((q) => {
                const positive = (q.regularMarketChangePercent ?? 0) >= 0;
                return (
                  <li key={q.symbol} className="border border-border bg-black/30 px-2 py-1">
                    <div className="text-2xs font-bold uppercase tracking-widest text-accent">
                      {q.symbol}
                    </div>
                    <div className="font-mono text-sm tabular-nums text-zinc-100">
                      {q.regularMarketPrice?.toFixed(2) ?? "—"}
                    </div>
                    <div className={`font-mono text-2xs tabular-nums ${positive ? "text-pos" : "text-neg"}`}>
                      {q.regularMarketChangePercent?.toFixed(2) ?? "0"}%
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-2 border border-border bg-panel">
        <div className="flex items-center gap-2 border-b border-border bg-black/40 px-2 py-1">
          <span className="text-2xs font-bold uppercase tracking-widest text-accent">N1</span>
          <span className="text-2xs font-medium uppercase tracking-widest text-zinc-300">NEWS WIRE</span>
        </div>
        <div className="px-2 py-2">
          {feed.status === "rejected" ? (
            <p className="text-2xs uppercase text-neg">feed error</p>
          ) : (
            <ul className="grid grid-cols-1 gap-1 md:grid-cols-2 xl:grid-cols-3">
              {feedList.map((it) => (
                <li key={it.guid ?? it.link} className="border border-border bg-black/30 px-2 py-1">
                  <a
                    href={it.link}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-xs text-zinc-100 hover:text-accent"
                  >
                    {it.title}
                  </a>
                  <div className="text-2xs uppercase tracking-widest text-zinc-600">
                    {it.feedName} · {it.isoDate ? new Date(it.isoDate).toLocaleString() : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

void Link;
