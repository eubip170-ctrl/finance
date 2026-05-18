"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { BENCHMARK_CATALOG } from "@/lib/charts/benchmarkCatalog";

export interface TickerSuggestion {
  ticker: string;
  name: string;
  exchange_acronym?: string;
  exchange_mic?: string;
  exchange_name?: string;
  country?: string;
  country_code?: string;
}

export interface ExchangePreset {
  mic: string;
  label: string;
  country: string;
}

export const EXCHANGE_PRESETS: ExchangePreset[] = [
  { mic: "", label: "All exchanges", country: "" },
  { mic: "XNAS", label: "NASDAQ", country: "USA" },
  { mic: "XNYS", label: "NYSE", country: "USA" },
  { mic: "ARCX", label: "NYSE Arca", country: "USA" },
  { mic: "BATS", label: "Cboe BZX", country: "USA" },
  { mic: "XLON", label: "London (LSE)", country: "GBR" },
  { mic: "XMIL", label: "Borsa Italiana", country: "ITA" },
  { mic: "XETR", label: "Xetra (Frankfurt)", country: "DEU" },
  { mic: "XPAR", label: "Euronext Paris", country: "FRA" },
  { mic: "XTKS", label: "Tokyo", country: "JPN" },
  { mic: "XHKG", label: "Hong Kong", country: "HKG" },
  { mic: "XTSE", label: "Toronto", country: "CAN" },
];

interface TickerAutocompleteProps {
  value: string;
  onChange: (value: string, suggestion?: TickerSuggestion) => void;
  placeholder?: string;
  className?: string;
  exchange?: string;
  onExchangeChange?: (mic: string) => void;
  showExchangeFilter?: boolean;
  autoFocus?: boolean;
  inputClassName?: string;
}

const MIN_CHARS = 1;
const MAX_RESULTS = 20;

// Build a flat searchable index of the benchmark catalog. This is the local
// data source; for ad-hoc tickers, the user types and hits Enter or +Add.
const CATALOG_INDEX: TickerSuggestion[] = (() => {
  const out: TickerSuggestion[] = [];
  for (const g of BENCHMARK_CATALOG) {
    for (const it of g.items) {
      out.push({
        ticker: it.t,
        name: it.n,
        exchange_acronym: g.label.toUpperCase().slice(0, 8),
      });
    }
  }
  return out;
})();

function filterIndex(q: string): TickerSuggestion[] {
  const needle = q.trim().toUpperCase();
  if (!needle) return [];
  const starts: TickerSuggestion[] = [];
  const contains: TickerSuggestion[] = [];
  for (const s of CATALOG_INDEX) {
    const t = s.ticker.toUpperCase();
    const n = s.name.toUpperCase();
    if (t.startsWith(needle) || n.startsWith(needle)) starts.push(s);
    else if (t.includes(needle) || n.includes(needle)) contains.push(s);
    if (starts.length + contains.length >= MAX_RESULTS * 2) break;
  }
  return [...starts, ...contains].slice(0, MAX_RESULTS);
}

export function TickerAutocomplete({
  value,
  onChange,
  placeholder = "AAPL",
  className = "",
  exchange = "",
  onExchangeChange,
  showExchangeFilter = false,
  autoFocus = false,
  inputClassName = "",
}: TickerAutocompleteProps) {
  const [results, setResults] = useState<TickerSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const q = value.trim();
    if (q.length < MIN_CHARS) {
      setResults([]);
      return;
    }
    setResults(filterIndex(q));
  }, [value, open]);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const updatePosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minWidth = 320;
    const maxWidth = Math.min(window.innerWidth - 24, 720);
    const desired = Math.max(rect.width, minWidth);
    const width = Math.min(desired, maxWidth);
    let left = rect.left;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }
    setPos({ top: rect.bottom + 4, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const handler = () => updatePosition();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open, updatePosition]);

  function handleSelect(s: TickerSuggestion) {
    onChange(s.ticker, s);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (open && activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault();
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const showDropdown = open && value.trim().length >= MIN_CHARS && results.length > 0;

  return (
    <div
      ref={containerRef}
      className={`relative ${showExchangeFilter ? "flex gap-2" : ""} ${className}`}
    >
      {showExchangeFilter && onExchangeChange && (
        <select
          className="input-field w-[140px] shrink-0"
          value={exchange}
          onChange={(e) => onExchangeChange(e.target.value)}
          aria-label="Filter by exchange"
        >
          {EXCHANGE_PRESETS.map((ex) => (
            <option key={ex.mic || "all"} value={ex.mic}>
              {ex.label}
            </option>
          ))}
        </select>
      )}
      <div className="relative flex-1">
        <input
          ref={inputRef}
          className={`input-field font-mono uppercase tracking-wide w-full ${inputClassName}`}
          value={value}
          onChange={(e) => {
            onChange(e.target.value.toUpperCase());
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
          }
        />
        {mounted && showDropdown && createPortal(
          <ul
            ref={dropdownRef}
            id={listboxId}
            role="listbox"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 1000,
            }}
            className="max-h-96 overflow-y-auto border border-border bg-card shadow-lg"
          >
            {results.map((s, i) => {
              const isActive = i === activeIndex;
              return (
                <li
                  key={`${s.ticker}-${i}`}
                  id={`${listboxId}-opt-${i}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(s);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex cursor-pointer items-center gap-2 border-b border-border px-2 py-1 last:border-b-0 ${
                    isActive ? "bg-accent-soft" : "hover:bg-black/60"
                  }`}
                >
                  <span className="min-w-[64px] font-mono text-xs font-bold uppercase text-accent">
                    {s.ticker}
                  </span>
                  <span className="flex-1 truncate text-2xs uppercase tracking-wider text-zinc-300">
                    {s.name}
                  </span>
                  {s.exchange_acronym && (
                    <span className="shrink-0 border border-border px-1 py-0.5 text-[0.6rem] uppercase tracking-widest text-zinc-500">
                      {s.exchange_acronym}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
      </div>
    </div>
  );
}
