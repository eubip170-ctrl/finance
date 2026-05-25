import Link from "next/link";
import { getLatestBrief } from "@/lib/brain/brief";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SENTIMENT_TONE: Record<"bullish" | "bearish" | "neutral", string> = {
  bullish: "text-pos",
  bearish: "text-neg",
  neutral: "text-zinc-400",
};

export default async function BriefPage() {
  const brief = await getLatestBrief();

  return (
    <main className="px-3 py-3">
      <div className="flex items-center gap-3 border-b border-border pb-1">
        <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
          BRN
        </span>
        <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">
          DAILY BRIEF
        </h1>
        {brief && (
          <span className="text-2xs uppercase tracking-widest text-zinc-500">
            · {new Date(brief.createdAt).toUTCString().slice(5, 22)}
          </span>
        )}
        <Link
          href="/brain"
          className="ml-auto border border-accent/60 px-2 py-0.5 text-2xs uppercase tracking-widest text-accent hover:bg-accent/10"
        >
          ← BRAIN
        </Link>
      </div>

      {!brief && (
        <div className="mt-4 border border-border bg-panel px-3 py-6 text-center text-2xs uppercase tracking-widest text-zinc-500">
          NO BRIEF YET. The brief generator runs once a day — trigger it
          manually via{" "}
          <code className="text-accent">POST /api/cron/generate-brief</code>{" "}
          (Authorization: Bearer CRON_SECRET) or wait for the scheduled run.
        </div>
      )}

      {brief && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            <Stat label="TOPICS" value={brief.meta.perTopic?.length ?? 0} />
            <Stat label="SOURCES" value={brief.meta.sourceCount ?? "—"} />
            <Stat label="WINDOW" value={`${brief.meta.windowHours ?? 28}H`} />
            <Stat
              label="GENERATED"
              value={new Date(brief.createdAt).toLocaleString(undefined, {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
          </div>

          <div className="mt-3 space-y-3">
            {(brief.meta.perTopic ?? []).map((topic, ti) => {
              const sectionRegex = new RegExp(
                `## ${escapeRegex(topic.topic.toUpperCase())}[^\n]*\n+([\\s\\S]*?)(?=\n## |$)`,
                "i",
              );
              const match = brief.body.match(sectionRegex);
              const body = match
                ? match[1].split(/\n+Sources:[\s\S]*/)[0].trim()
                : "(synthesis not found)";
              return (
                <section key={`${topic.topic}-${ti}`} className="border border-border bg-panel">
                  <div className="flex items-center gap-2 border-b border-border bg-black/40 px-2 py-1">
                    <span className="text-2xs font-bold uppercase tracking-widest text-accent">
                      {String(ti + 1).padStart(2, "0")}
                    </span>
                    <span className="text-2xs font-bold uppercase tracking-widest text-zinc-200">
                      {topic.topic}
                    </span>
                    <span className="text-2xs uppercase tracking-widest text-zinc-500">
                      · {topic.docCount} src
                    </span>
                    <SentimentChip s={topic.sentiment} />
                  </div>
                  <div className="px-3 py-2">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
                      {body}
                    </p>
                    {topic.sources.length > 0 && (
                      <ul className="mt-2 grid grid-cols-1 gap-1 border-t border-border pt-2 md:grid-cols-2">
                        {topic.sources.map((s, i) => (
                          <li
                            key={s.id}
                            className="flex items-start gap-2 border border-border/60 bg-black/30 px-2 py-1"
                          >
                            <span className="font-mono text-2xs font-bold uppercase tracking-widest text-accent">
                              [{i + 1}]
                            </span>
                            <span className="flex-1 truncate text-2xs text-zinc-300">
                              {s.title}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-border bg-panel px-2 py-1">
      <div className="text-2xs uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="mt-0.5 font-mono text-lg tabular-nums text-zinc-100">{value}</div>
    </div>
  );
}

function SentimentChip({ s }: { s: { bullish: number; bearish: number; neutral: number } }) {
  return (
    <span className="ml-auto flex items-center gap-1 text-2xs uppercase tracking-widest">
      <span className={SENTIMENT_TONE.bullish}>B{s.bullish}</span>
      <span className={SENTIMENT_TONE.bearish}>B{s.bearish}</span>
      <span className={SENTIMENT_TONE.neutral}>N{s.neutral}</span>
    </span>
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
