"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const EVENT_TYPES = [
  "monetary_policy",
  "fiscal_policy",
  "geopolitical",
  "regulation",
  "macro_release",
  "corporate",
  "commodity",
  "energy",
  "other",
] as const;

export default function NewEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [eventType, setEventType] = useState<(typeof EVENT_TYPES)[number]>("monetary_policy");
  const [rawText, setRawText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, summary, eventType, rawText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "request failed");
      router.push(`/events/${json.eventId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/events" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Events
      </Link>
      <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">New event</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5 sm:mt-8">
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="input"
            placeholder="e.g. FOMC keeps rates unchanged, signals 2 cuts in 2026"
          />
        </Field>

        <Field label="Event type">
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as (typeof EVENT_TYPES)[number])}
            className="input"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Short summary (optional)">
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="input"
            placeholder="One-liner used as the prompt seed alongside the raw text"
          />
        </Field>

        <Field label="Raw text (statement / article / brief)">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            required
            rows={12}
            className="input font-mono text-xs"
            placeholder="Paste the full event text. The studier extracts ontology + actors from this."
          />
        </Field>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md border border-accent/40 bg-accent/10 px-5 py-2 text-sm text-accent hover:bg-accent/20 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create event"}
        </button>
      </form>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          background: #0a0a0b;
          border: 1px solid #1f1f23;
          color: #e4e4e7;
          padding: 0.55rem 0.75rem;
          border-radius: 6px;
          font-size: 0.875rem;
        }
        :global(.input:focus) {
          outline: none;
          border-color: rgba(212, 175, 55, 0.5);
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
