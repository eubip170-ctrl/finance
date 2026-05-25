import Link from "next/link";
import { getLatestProfile } from "@/lib/brain/profile";
import { RegenerateButton } from "./regenerate-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SENTIMENT_TONE = {
  bullish: "text-pos",
  bearish: "text-neg",
  neutral: "text-zinc-400",
} as const;

export default async function EntityProfilePage(props: { params: Promise<{ name: string }> }) {
  const { name } = await props.params;
  const decoded = decodeURIComponent(name);

  let profile: Awaited<ReturnType<typeof getLatestProfile>> = null;
  let error: string | null = null;
  try {
    profile = await getLatestProfile(decoded);
  } catch (err) {
    error = err instanceof Error ? err.message : "unknown";
  }

  const total =
    profile?.sentiment
      ? profile.sentiment.bullish + profile.sentiment.bearish + profile.sentiment.neutral
      : 0;
  const tilt: keyof typeof SENTIMENT_TONE =
    !profile || total === 0
      ? "neutral"
      : profile.sentiment.bullish > profile.sentiment.bearish && profile.sentiment.bullish > profile.sentiment.neutral
        ? "bullish"
        : profile.sentiment.bearish > profile.sentiment.bullish && profile.sentiment.bearish > profile.sentiment.neutral
          ? "bearish"
          : "neutral";

  const maxWeekly = Math.max(1, ...((profile?.weeklyMentions ?? []).map((w) => w.count)));

  return (
    <main className="px-3 py-3">
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-1">
        <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
          ENT
        </span>
        <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">
          {decoded}
        </h1>
        {profile?.kinds && profile.kinds.length > 0 && (
          <span className="text-2xs uppercase tracking-widest text-zinc-500">
            · {profile.kinds.join(" · ")}
          </span>
        )}
        {profile && (
          <span className="text-2xs uppercase tracking-widest text-zinc-500">
            · {new Date(profile.generatedAt).toUTCString().slice(5, 22)}
          </span>
        )}
        <RegenerateButton name={name} />
        <Link
          href="/brain/entities"
          className="border border-accent/60 px-2 py-0.5 text-2xs uppercase tracking-widest text-accent hover:bg-accent/10"
        >
          ENTITIES
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

      {!profile && !error && (
        <div className="mt-6 border border-border bg-panel px-3 py-6 text-center text-2xs uppercase tracking-widest text-zinc-500">
          No profile yet for{" "}
          <span className="text-accent">{decoded}</span>. Click REGENERATE
          (needs ≥3 enriched docs mentioning this entity in the last 60 days).
        </div>
      )}

      {profile && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            <Stat label="MENTIONS" value={profile.docCount} />
            <Stat label="WINDOW" value={`${profile.windowDays}D`} />
            <Stat
              label="SENTIMENT TILT"
              value={tilt.toUpperCase()}
              tone={SENTIMENT_TONE[tilt]}
            />
            <Stat
              label="B · B · N"
              value={`${profile.sentiment.bullish} · ${profile.sentiment.bearish} · ${profile.sentiment.neutral}`}
            />
            <Stat label="TOPICS" value={profile.topTopics.length} />
          </div>

          {profile.weeklyMentions.length > 1 && (
            <Section code="T1" title="MENTIONS · WEEKLY">
              <ul className="flex items-end gap-1">
                {profile.weeklyMentions.map((w) => {
                  const h = Math.max(2, Math.round((w.count / maxWeekly) * 56));
                  return (
                    <li
                      key={w.weekStart}
                      className="flex w-6 flex-col items-center"
                      title={`${w.weekStart}: ${w.count}`}
                    >
                      <div
                        className="w-full bg-accent/70"
                        style={{ height: `${h}px` }}
                      />
                      <span className="mt-1 text-[8px] text-zinc-600">
                        {w.weekStart.slice(5)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          <Section code="01" title="IDENTITY">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
              {profile.sections.identity || "—"}
            </p>
          </Section>

          <Section code="02" title="LATEST ACTIVITY">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
              {profile.sections.latestActivity || "—"}
            </p>
          </Section>

          {profile.sections.themes.length > 0 && (
            <Section code="03" title="THEMES">
              <ul className="space-y-1 text-sm leading-relaxed text-zinc-100">
                {profile.sections.themes.map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-2xs text-accent">→</span>
                    <span className="flex-1">{t}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {profile.coOccurringEntities.length > 0 && (
            <Section code="04" title="CONNECTIONS">
              <ul className="grid grid-cols-1 gap-1 md:grid-cols-2">
                {profile.coOccurringEntities.map((e) => (
                  <li
                    key={`${e.kind}:${e.name}`}
                    className="flex items-center justify-between border border-border/60 bg-black/30 px-2 py-1"
                  >
                    <Link
                      href={`/brain/entity/${encodeURIComponent(e.name)}`}
                      className="min-w-0 flex-1 truncate text-sm text-zinc-200 hover:text-accent"
                    >
                      {e.name}
                    </Link>
                    <span className="ml-2 text-2xs uppercase tracking-widest text-zinc-500">
                      {e.kind}
                    </span>
                    <span className="ml-2 font-mono text-2xs tabular-nums text-accent">
                      ×{e.count}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {profile.topTopics.length > 0 && (
            <Section code="05" title="APPEARS IN TOPICS">
              <ul className="flex flex-wrap gap-1">
                {profile.topTopics.map((t) => (
                  <li key={t.topic}>
                    <Link
                      href={`/brain/topic/${encodeURIComponent(t.topic)}`}
                      className="inline-flex items-center gap-1 rounded-sm border border-border bg-black/40 px-2 py-0.5 text-2xs uppercase tracking-widest text-zinc-300 hover:border-accent hover:text-accent"
                    >
                      {t.topic}
                      <span className="font-mono text-2xs text-accent">×{t.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section code="06" title="WHAT TO WATCH">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
              {profile.sections.watchPoints || "—"}
            </p>
          </Section>

          {profile.sources.length > 0 && (
            <Section code="S" title={`SOURCES · ${profile.sources.length}`}>
              <ul className="grid grid-cols-1 gap-1 md:grid-cols-2">
                {profile.sources.map((s, i) => (
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
