import Link from "next/link";
import { getLatestDossier } from "@/lib/brain/dossier";
import { RegenerateButton } from "./regenerate-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SENTIMENT_TONE = {
  bullish: "text-pos",
  bearish: "text-neg",
  neutral: "text-zinc-400",
} as const;

export default async function TopicDossierPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const topic = decodeURIComponent(slug);

  let dossier: Awaited<ReturnType<typeof getLatestDossier>> = null;
  let error: string | null = null;
  try {
    dossier = await getLatestDossier(topic);
  } catch (err) {
    error = err instanceof Error ? err.message : "unknown";
  }

  const total =
    dossier?.sentiment
      ? dossier.sentiment.bullish + dossier.sentiment.bearish + dossier.sentiment.neutral
      : 0;
  const tilt: keyof typeof SENTIMENT_TONE =
    !dossier || total === 0
      ? "neutral"
      : dossier.sentiment.bullish > dossier.sentiment.bearish && dossier.sentiment.bullish > dossier.sentiment.neutral
        ? "bullish"
        : dossier.sentiment.bearish > dossier.sentiment.bullish && dossier.sentiment.bearish > dossier.sentiment.neutral
          ? "bearish"
          : "neutral";

  return (
    <main className="px-3 py-3">
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-1">
        <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
          TPC
        </span>
        <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">
          {topic}
        </h1>
        {dossier && (
          <span className="text-2xs uppercase tracking-widest text-zinc-500">
            · {new Date(dossier.generatedAt).toUTCString().slice(5, 22)}
          </span>
        )}
        <RegenerateButton slug={slug} />
        <Link
          href="/brain/topics"
          className="border border-accent/60 px-2 py-0.5 text-2xs uppercase tracking-widest text-accent hover:bg-accent/10"
        >
          TOPICS
        </Link>
        <Link
          href="/brain"
          className="border border-accent/60 px-2 py-0.5 text-2xs uppercase tracking-widest text-accent hover:bg-accent/10"
        >
          ← BRAIN
        </Link>
      </div>

      {error && (
        <div className="mt-3 border border-neg/60 bg-neg/10 px-3 py-2 text-2xs uppercase tracking-widest text-neg">
          {error}
        </div>
      )}

      {!dossier && !error && (
        <div className="mt-6 border border-border bg-panel px-3 py-6 text-center text-2xs uppercase tracking-widest text-zinc-500">
          No dossier yet for{" "}
          <span className="text-accent">{topic}</span>. Click REGENERATE
          above (needs ≥4 enriched docs on this topic in the last 30 days).
        </div>
      )}

      {dossier && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            <Stat label="DOCS" value={dossier.docCount} />
            <Stat label="WINDOW" value={`${dossier.windowDays}D`} />
            <Stat
              label="SENTIMENT TILT"
              value={tilt.toUpperCase()}
              tone={SENTIMENT_TONE[tilt]}
            />
            <Stat
              label="B · B · N"
              value={`${dossier.sentiment.bullish} · ${dossier.sentiment.bearish} · ${dossier.sentiment.neutral}`}
            />
            <Stat
              label="GENERATED"
              value={new Date(dossier.generatedAt).toLocaleString(undefined, {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
          </div>

          <Section code="01" title="CURRENT STATE">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
              {dossier.sections.currentState || "—"}
            </p>
          </Section>

          {dossier.sections.keyDrivers.length > 0 && (
            <Section code="02" title="KEY DRIVERS">
              <ul className="space-y-1 text-sm leading-relaxed text-zinc-100">
                {dossier.sections.keyDrivers.map((d, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-2xs text-accent">→</span>
                    <span className="flex-1">{d}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section code="03" title="SENTIMENT">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
              {dossier.sections.sentimentNote || "—"}
            </p>
          </Section>

          {dossier.sections.topEntities.length > 0 && (
            <Section code="04" title="TOP ENTITIES">
              <ul className="grid grid-cols-1 gap-1 md:grid-cols-2">
                {dossier.sections.topEntities.map((e) => (
                  <li
                    key={`${e.kind}:${e.name}`}
                    className="flex items-center justify-between border border-border/60 bg-black/30 px-2 py-1"
                  >
                    <Link
                      href={`/brain?entity=${encodeURIComponent(e.name)}`}
                      className="min-w-0 flex-1 truncate text-sm text-zinc-200 hover:text-accent"
                      title={`${e.kind}: ${e.name}`}
                    >
                      {e.name}
                    </Link>
                    <span className="ml-2 text-2xs uppercase tracking-widest text-zinc-500">
                      {e.kind}
                    </span>
                    <span className="ml-2 font-mono text-2xs tabular-nums text-accent">
                      ×{e.mentions}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section code="05" title="OUTLOOK">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
              {dossier.sections.outlook || "—"}
            </p>
          </Section>

          {dossier.sources.length > 0 && (
            <Section code="S" title={`SOURCES · ${dossier.sources.length}`}>
              <ul className="grid grid-cols-1 gap-1 md:grid-cols-2">
                {dossier.sources.map((s, i) => (
                  <li
                    key={s.id}
                    className="flex items-start gap-2 border border-border/60 bg-black/30 px-2 py-1"
                  >
                    <span className="font-mono text-2xs font-bold uppercase tracking-widest text-accent">
                      [{i + 1}]
                    </span>
                    <span className="flex-1 truncate text-2xs text-zinc-300">{s.title}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="border border-border bg-panel px-2 py-1">
      <div className="text-2xs uppercase tracking-widest text-zinc-500">{label}</div>
      <div className={`mt-0.5 font-mono text-lg tabular-nums ${tone ?? "text-zinc-100"}`}>
        {value}
      </div>
    </div>
  );
}

function Section({
  code,
  title,
  children,
}: {
  code: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-3 border border-border bg-panel">
      <div className="flex items-center gap-2 border-b border-border bg-black/40 px-2 py-1">
        <span className="text-2xs font-bold uppercase tracking-widest text-accent">{code}</span>
        <span className="text-2xs font-bold uppercase tracking-widest text-zinc-200">{title}</span>
      </div>
      <div className="px-3 py-2">{children}</div>
    </section>
  );
}
