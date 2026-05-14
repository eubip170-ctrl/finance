"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

type Scenario = {
  name?: string;
  probability?: number;
  summary?: string;
  key_drivers?: string[];
};

type ImpactedAsset = {
  asset?: string;
  direction?: "long" | "short" | "neutral" | string;
  conviction?: "low" | "medium" | "high" | string;
  horizon?: string;
  rationale?: string;
};

type Props = {
  title: string;
  createdAt: string;
  body: string;
  scenarios?: Scenario[];
  impactedAssets?: ImpactedAsset[];
};

/**
 * Renders a scenario report with a modern "terminal" aesthetic — monospace,
 * subtle ANSI-inspired accents, collapsible sections, syntax-highlighted code.
 * The trailing ```json block in body_md is hidden because we render scenarios
 * + impacted_assets as proper UI components.
 */
export function ReportRenderer({
  title,
  createdAt,
  body,
  scenarios = [],
  impactedAssets = [],
}: Props) {
  // Strip the trailing ```json ... ``` block — we render its data structurally.
  const cleanBody = useMemo(() => stripTrailingJson(body), [body]);

  return (
    <div className="font-mono">
      <TerminalHeader title={title} createdAt={createdAt} />

      <section className="mt-6 rounded-lg border border-border bg-panel/40 p-0 backdrop-blur">
        <div className="border-b border-border bg-panel/70 px-4 py-2 text-xs text-zinc-500">
          <span className="text-emerald-400">$</span>{" "}
          <span className="text-zinc-300">cat report.md</span>
        </div>
        <article className="prose-terminal px-4 py-5 text-[13.5px] leading-relaxed sm:px-6 sm:py-6">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={MD_COMPONENTS}
          >
            {cleanBody}
          </ReactMarkdown>
        </article>
      </section>

      {scenarios.length > 0 && <ScenariosBlock scenarios={scenarios} />}
      {impactedAssets.length > 0 && <ImpactedAssetsBlock assets={impactedAssets} />}
    </div>
  );
}

function TerminalHeader({ title, createdAt }: { title: string; createdAt: string }) {
  return (
    <div className="rounded-lg border border-border bg-panel/60 px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2 text-xs">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-3 text-zinc-500">~/reports — scenario.md</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-emerald-400">❯</span>
        <h1 className="break-words font-mono text-lg text-zinc-100 sm:text-xl">
          {title}
        </h1>
      </div>
      <div className="mt-1 pl-5 text-xs text-zinc-500">
        // generated {new Date(createdAt).toLocaleString()}
      </div>
    </div>
  );
}

function ScenariosBlock({ scenarios }: { scenarios: Scenario[] }) {
  return (
    <Section title="scenarios.json" defaultOpen>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {scenarios.map((s, i) => (
          <ScenarioCard key={i} s={s} />
        ))}
      </div>
    </Section>
  );
}

function ScenarioCard({ s }: { s: Scenario }) {
  const tone = scenarioTone(s.name);
  const prob = typeof s.probability === "number" ? s.probability : null;
  return (
    <div
      className="rounded-md border bg-bg/60 p-3 text-xs"
      style={{ borderColor: tone.border }}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold" style={{ color: tone.fg }}>
          {(s.name ?? "scenario").toLowerCase()}
        </span>
        {prob !== null && (
          <span className="rounded bg-panel px-1.5 py-0.5 text-[10px] text-zinc-400">
            p = {(prob * 100).toFixed(0)}%
          </span>
        )}
      </div>
      {prob !== null && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-panel">
          <div
            className="h-full"
            style={{ width: `${Math.max(2, Math.min(100, prob * 100))}%`, backgroundColor: tone.fg }}
          />
        </div>
      )}
      {s.summary && (
        <p className="mt-2 whitespace-pre-wrap text-zinc-300">{s.summary}</p>
      )}
      {s.key_drivers && s.key_drivers.length > 0 && (
        <ul className="mt-2 space-y-0.5 pl-3 text-zinc-500">
          {s.key_drivers.map((d, i) => (
            <li key={i} className="before:mr-1 before:text-zinc-600 before:content-['→']">
              {d}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ImpactedAssetsBlock({ assets }: { assets: ImpactedAsset[] }) {
  return (
    <Section title="impacted_assets.tsv">
      <div className="overflow-x-auto rounded-md border border-border bg-bg/60">
        <table className="w-full min-w-[600px] border-collapse text-xs">
          <thead className="bg-panel/60 text-zinc-500">
            <tr>
              <Th>asset</Th>
              <Th>direction</Th>
              <Th>conviction</Th>
              <Th>horizon</Th>
              <Th className="w-1/2">rationale</Th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a, i) => {
              const dir = directionTone(a.direction);
              const conv = convictionTone(a.conviction);
              return (
                <tr key={i} className="border-t border-border">
                  <Td className="font-semibold text-zinc-100">{a.asset ?? "—"}</Td>
                  <Td>
                    <span
                      className="rounded px-1.5 py-0.5 text-[11px]"
                      style={{ backgroundColor: `${dir.fg}22`, color: dir.fg }}
                    >
                      {a.direction ?? "n/a"}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ color: conv.fg }}>{a.conviction ?? "—"}</span>
                  </Td>
                  <Td className="text-zinc-400">{a.horizon ?? "—"}</Td>
                  <Td className="text-zinc-400">{a.rationale ?? ""}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mt-5 rounded-lg border border-border bg-panel/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between border-b border-border bg-panel/70 px-4 py-2 text-left text-xs text-zinc-400 hover:text-zinc-100"
      >
        <span>
          <span className="text-emerald-400">$</span>{" "}
          <span className="text-zinc-200">cat</span>{" "}
          <span className="text-zinc-500">{title}</span>
        </span>
        <span className="text-zinc-500">{open ? "[−]" : "[+]"}</span>
      </button>
      {open && <div className="px-4 py-4 sm:px-6">{children}</div>}
    </section>
  );
}

const Th = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <th className={`px-3 py-2 text-left font-medium uppercase tracking-wide ${className ?? ""}`}>
    {children}
  </th>
);
const Td = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={`px-3 py-2 align-top ${className ?? ""}`}>{children}</td>
);

// --- Style helpers ----------------------------------------------------------

const ACCENT = {
  green: "#3fb98f",
  red: "#ff6b6b",
  cyan: "#6dd3ff",
  yellow: "#f7d046",
  zinc: "#9ca3af",
};

function scenarioTone(name?: string): { fg: string; border: string } {
  const n = (name ?? "").toLowerCase();
  if (n.includes("bull") || n.includes("upside")) return { fg: ACCENT.green, border: "#1f3f30" };
  if (n.includes("bear") || n.includes("downside")) return { fg: ACCENT.red, border: "#3f1f20" };
  return { fg: ACCENT.cyan, border: "#1f2f3a" };
}
function directionTone(d?: string): { fg: string } {
  const n = (d ?? "").toLowerCase();
  if (n === "long") return { fg: ACCENT.green };
  if (n === "short") return { fg: ACCENT.red };
  if (n === "neutral") return { fg: ACCENT.zinc };
  return { fg: ACCENT.zinc };
}
function convictionTone(c?: string): { fg: string } {
  const n = (c ?? "").toLowerCase();
  if (n === "high") return { fg: ACCENT.green };
  if (n === "medium") return { fg: ACCENT.yellow };
  if (n === "low") return { fg: ACCENT.zinc };
  return { fg: ACCENT.zinc };
}

function stripTrailingJson(md: string): string {
  return md.replace(/\n*```json\s*[\s\S]+?```\s*$/i, "").trim();
}

// --- react-markdown component overrides ------------------------------------

const MD_COMPONENTS = {
  h1: (p: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="mt-6 flex items-baseline gap-2 text-base font-semibold uppercase tracking-wide text-zinc-100">
      <span className="text-emerald-400">▌</span>
      <span {...p} />
    </h1>
  ),
  h2: (p: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mt-6 flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-200">
      <span className="text-emerald-400">»</span>
      <span {...p} />
    </h2>
  ),
  h3: (p: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mt-5 text-[13px] font-semibold text-zinc-300">
      <span className="mr-2 text-zinc-500">#</span>
      <span {...p} />
    </h3>
  ),
  p: (p: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mt-3 text-zinc-300" {...p} />
  ),
  ul: (p: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="mt-3 space-y-1 pl-1" {...p} />
  ),
  ol: (p: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="mt-3 list-decimal space-y-1 pl-5 text-zinc-300" {...p} />
  ),
  li: (p: React.HTMLAttributes<HTMLLIElement>) => (
    <li
      className="flex gap-2 text-zinc-300 before:mt-1 before:shrink-0 before:text-emerald-400 before:content-['▸']"
      {...p}
    />
  ),
  blockquote: (p: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="mt-3 border-l-2 border-accent/60 bg-accent/5 px-3 py-2 text-zinc-300"
      {...p}
    />
  ),
  table: (p: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="mt-4 overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[480px] border-collapse text-xs" {...p} />
    </div>
  ),
  th: (p: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th className="border-b border-border bg-panel/60 px-2.5 py-1.5 text-left font-medium uppercase tracking-wide text-zinc-400" {...p} />
  ),
  td: (p: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td className="border-b border-border/60 px-2.5 py-1.5 align-top text-zinc-300" {...p} />
  ),
  code: (p: React.HTMLAttributes<HTMLElement> & { className?: string }) => {
    if (p.className && p.className.includes("language-")) {
      return <code {...p} />; // fenced block — let rehype-highlight do its thing
    }
    return (
      <code
        className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[12px] text-emerald-300"
        {...p}
      />
    );
  },
  pre: (p: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="mt-3 overflow-x-auto rounded-md border border-border bg-bg/80 p-3 text-[12px] leading-relaxed"
      {...p}
    />
  ),
  a: (p: React.HTMLAttributes<HTMLAnchorElement>) => (
    <a
      className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
      target="_blank"
      rel="noreferrer"
      {...p}
    />
  ),
  strong: (p: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-zinc-100" {...p} />
  ),
  hr: () => <hr className="my-6 border-border" />,
};
