"use client";

import { useCallback, useState } from "react";
import { Play, RefreshCw, Copy, CheckCircle2 } from "lucide-react";

interface ProbeRow {
  ticker: string;
  ok: boolean;
  rows: number;
  lastDate: string | null;
  error: string | null;
  ms: number;
}
interface ProbeResp {
  ok: boolean;
  total: number;
  okCount: number;
  failedCount: number;
  universeSize: number;
  results: ProbeRow[];
  topErrors: Array<{ message: string; count: number }>;
  durationMs: number;
  nextOffset: number | null;
  error?: string;
}

export function MarketstackProbe() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<ProbeRow[]>([]);
  const [errSummary, setErrSummary] = useState<Array<{ message: string; count: number }>>([]);
  const [generalError, setGeneralError] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const runProbe = useCallback(async () => {
    setRunning(true);
    setResults([]);
    setErrSummary([]);
    setGeneralError("");
    setProgress({ done: 0, total: 0 });
    try {
      let offset = 0;
      const all: ProbeRow[] = [];
      while (true) {
        const url = `/api/health/marketstack?offset=${offset}&limit=30&concurrency=6`;
        const res = await fetch(url);
        const j = (await res.json()) as ProbeResp;
        if (!res.ok) {
          setGeneralError(j.error || `HTTP ${res.status}`);
          break;
        }
        all.push(...j.results);
        setResults([...all]);
        setProgress({ done: all.length, total: j.universeSize });
        if (j.nextOffset == null) {
          // Final pass: re-derive top errors over the full set so the summary is accurate.
          const counts: Record<string, number> = {};
          for (const r of all) {
            if (!r.ok) {
              const k = (r.error ?? "unknown").slice(0, 80);
              counts[k] = (counts[k] ?? 0) + 1;
            }
          }
          setErrSummary(
            Object.entries(counts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([message, count]) => ({ message, count })),
          );
          break;
        }
        offset = j.nextOffset;
      }
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : "unknown");
    } finally {
      setRunning(false);
    }
  }, []);

  const okCount = results.filter((r) => r.ok).length;
  const failedCount = results.length - okCount;
  const failed = results.filter((r) => !r.ok);

  function copyFailedList() {
    const text = failed.map((r) => r.ticker).join(",");
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      <p className="text-2xs uppercase tracking-widest text-zinc-500">
        Probes every dashboard ticker against MarketStack v2 EOD individually. Runs in
        batches of 30 with 6 parallel workers. Use this to identify which symbols are not
        supported on your plan.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button onClick={runProbe} disabled={running} className="btn-primary">
          {running ? (
            <>
              <RefreshCw size={11} className="animate-spin" />
              RUNNING {progress.done}/{progress.total}
            </>
          ) : (
            <>
              <Play size={11} /> RUN PROBE
            </>
          )}
        </button>
        {results.length > 0 && (
          <>
            <span className="text-2xs uppercase tracking-widest text-pos">
              OK {okCount}
            </span>
            <span className="text-2xs uppercase tracking-widest text-neg">
              FAILED {failedCount}
            </span>
            {failedCount > 0 && (
              <button onClick={copyFailedList} className="btn-secondary">
                {copied ? <CheckCircle2 size={11} /> : <Copy size={11} />}{" "}
                {copied ? "COPIED" : "COPY FAILED LIST"}
              </button>
            )}
          </>
        )}
      </div>

      {generalError && (
        <div className="mt-2 border border-neg/60 bg-neg/10 px-2 py-1 text-2xs uppercase text-neg">
          {generalError}
        </div>
      )}

      {errSummary.length > 0 && (
        <div className="mt-2 border border-border bg-black/40">
          <div className="border-b border-border px-2 py-1 text-2xs font-bold uppercase tracking-widest text-zinc-500">
            ERRORS BY KIND
          </div>
          <ul className="divide-y divide-border">
            {errSummary.map((e) => (
              <li
                key={e.message}
                className="flex items-center justify-between gap-2 px-2 py-1 text-2xs font-mono"
              >
                <span className="truncate text-zinc-300">{e.message}</span>
                <span className="font-bold tabular-nums text-neg">{e.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-2 overflow-x-auto border border-border">
          <table className="w-full font-mono text-2xs tabular-nums">
            <thead>
              <tr className="border-b border-border bg-black/40 text-left uppercase tracking-widest text-zinc-500">
                <th className="w-8 px-2 py-1"></th>
                <th className="px-2 py-1">TICKER</th>
                <th className="px-2 py-1 text-right">ROWS</th>
                <th className="px-2 py-1">LAST</th>
                <th className="px-2 py-1">ERROR</th>
                <th className="px-2 py-1 text-right">MS</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr
                  key={r.ticker}
                  className="border-b border-border/60 last:border-0 hover:bg-black/40"
                >
                  <td className="px-2 py-1">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        r.ok ? "bg-pos" : "bg-neg"
                      }`}
                    />
                  </td>
                  <td className="px-2 py-1 text-accent">{r.ticker}</td>
                  <td className="px-2 py-1 text-right text-zinc-300">{r.rows}</td>
                  <td className="px-2 py-1 text-zinc-500">{r.lastDate ?? "—"}</td>
                  <td className="px-2 py-1 text-zinc-400">{r.error ?? "—"}</td>
                  <td className="px-2 py-1 text-right text-zinc-600">{r.ms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
