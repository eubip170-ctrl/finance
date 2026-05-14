'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  RefreshCw,
  Square,
  Columns2,
  Columns3,
  Link2,
  Save,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { TickerAutocomplete } from '@/components/charts/TickerAutocomplete';
import {
  ChartPro,
  type ChartType,
  type Indicator,
  type ChartDrawing,
} from '@/components/charts/ChartPro';
import type { OHLCVRow } from '@/lib/charts/technicals';

const STORAGE_KEY = 'nevis.charts.v1';
const DEFAULT_TICKERS = ['SPY', 'QQQ', 'NVDA', 'AAPL'];

const RANGE_PRESETS: Array<{ label: string; days: number }> = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: 'YTD', days: 0 },
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
  { label: '5Y', days: 1825 },
];

const ALL_INDICATORS: Array<{ key: Indicator; label: string; group: 'overlay' | 'panel' }> = [
  { key: 'SMA8', label: 'SMA 8', group: 'overlay' },
  { key: 'SMA20', label: 'SMA 20', group: 'overlay' },
  { key: 'SMA50', label: 'SMA 50', group: 'overlay' },
  { key: 'SMA200', label: 'SMA 200', group: 'overlay' },
  { key: 'EMA21', label: 'EMA 21', group: 'overlay' },
  { key: 'BB', label: 'Bollinger', group: 'overlay' },
  { key: 'VWAP', label: 'VWAP', group: 'overlay' },
  { key: 'SR', label: 'S/R levels', group: 'overlay' },
  { key: 'RSI', label: 'RSI', group: 'panel' },
  { key: 'MACD', label: 'MACD', group: 'panel' },
  { key: 'ATR', label: 'ATR', group: 'panel' },
  { key: 'OBV', label: 'OBV', group: 'panel' },
];

interface ChartSettings {
  chartType: ChartType;
  indicators: Indicator[];
  showVolume: boolean;
  logScale: boolean;
  rangeDays: number;
}

interface ChartState extends ChartSettings {
  id: string;
  ticker: string;
  compareTicker?: string;
  drawings?: ChartDrawing[];
}

type LayoutCols = 1 | 2 | 3;

const DEFAULT_SETTINGS: ChartSettings = {
  chartType: 'candlestick',
  indicators: ['SMA20', 'SMA50', 'BB'],
  showVolume: true,
  logScale: false,
  rangeDays: 365,
};

interface ChartPreset {
  name: string;
  builtin?: boolean;
  chartType: ChartType;
  indicators: Indicator[];
  showVolume: boolean;
  logScale?: boolean;
}

const BUILTIN_PRESETS: ChartPreset[] = [
  { name: 'Trend', builtin: true, chartType: 'candlestick', indicators: ['SMA20', 'SMA50', 'SMA200', 'MACD'], showVolume: true },
  { name: 'Mean reversion', builtin: true, chartType: 'candlestick', indicators: ['BB', 'RSI', 'ATR'], showVolume: true },
  { name: 'Volume', builtin: true, chartType: 'candlestick', indicators: ['VWAP', 'EMA21', 'OBV'], showVolume: true },
  { name: 'Long-term', builtin: true, chartType: 'line', indicators: ['SMA50', 'SMA200'], showVolume: false, logScale: true },
];

function newId(): string {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface Persisted {
  charts: ChartState[];
  defaults: ChartSettings;
  layoutCols: LayoutCols;
  syncRanges?: boolean;
  userPresets?: ChartPreset[];
}

function loadPersisted(): Persisted {
  if (typeof window === 'undefined') {
    return {
      charts: DEFAULT_TICKERS.map((t) => ({ id: newId(), ticker: t, ...DEFAULT_SETTINGS })),
      defaults: DEFAULT_SETTINGS,
      layoutCols: 2,
      syncRanges: false,
      userPresets: [],
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Partial<Persisted>;
      const defaults = { ...DEFAULT_SETTINGS, ...(obj.defaults ?? {}) };
      const charts: ChartState[] = Array.isArray(obj.charts)
        ? obj.charts
            .filter((c): c is ChartState => !!c && typeof c.ticker === 'string')
            .map((c) => ({ ...DEFAULT_SETTINGS, ...c }))
        : [];
      return {
        charts: charts.length
          ? charts
          : DEFAULT_TICKERS.map((t) => ({ id: newId(), ticker: t, ...defaults })),
        defaults,
        layoutCols: obj.layoutCols === 1 || obj.layoutCols === 3 ? obj.layoutCols : 2,
        syncRanges: obj.syncRanges === true,
        userPresets: Array.isArray(obj.userPresets) ? obj.userPresets : [],
      };
    }
  } catch {}
  return {
    charts: DEFAULT_TICKERS.map((t) => ({ id: newId(), ticker: t, ...DEFAULT_SETTINGS })),
    defaults: DEFAULT_SETTINGS,
    layoutCols: 2,
    syncRanges: false,
    userPresets: [],
  };
}

export default function ChartsPage() {
  const [hydrated, setHydrated] = useState(false);
  const [charts, setCharts] = useState<ChartState[]>([]);
  const [defaults, setDefaults] = useState<ChartSettings>(DEFAULT_SETTINGS);
  const [layoutCols, setLayoutCols] = useState<LayoutCols>(2);
  const [syncRanges, setSyncRanges] = useState(false);
  const [userPresets, setUserPresets] = useState<ChartPreset[]>([]);

  const [draft, setDraft] = useState('');
  const [exchange, setExchange] = useState('');

  const [ohlcv, setOhlcv] = useState<Record<string, OHLCVRow[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [maxFetchedDays, setMaxFetchedDays] = useState(0);

  const [openSettings, setOpenSettings] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Hydrate from localStorage on first mount.
  useEffect(() => {
    const p = loadPersisted();
    setCharts(p.charts);
    setDefaults(p.defaults);
    setLayoutCols(p.layoutCols);
    setSyncRanges(p.syncRanges === true);
    setUserPresets(p.userPresets ?? []);
    setHydrated(true);
  }, []);

  // Persist.
  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    const p: Persisted = { charts, defaults, layoutCols, syncRanges, userPresets };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {}
  }, [hydrated, charts, defaults, layoutCols, syncRanges, userPresets]);

  const tickerSet = useMemo(() => {
    const out = new Set<string>();
    for (const c of charts) {
      out.add(c.ticker);
      if (c.compareTicker) out.add(c.compareTicker);
    }
    return Array.from(out);
  }, [charts]);

  const maxRange = useMemo(() => {
    let m = 730;
    for (const c of charts) m = Math.max(m, c.rangeDays || 365, 730);
    return m;
  }, [charts]);

  const refresh = useCallback(async (list: string[], days: number) => {
    if (list.length === 0) {
      setOhlcv({});
      setErrors({});
      return;
    }
    setLoading(true);
    setGeneralError('');
    try {
      const res = await fetch('/api/charts/ohlcv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: list, lookback_days: Math.max(days, 730) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGeneralError(data.error || 'Failed to load data.');
        return;
      }
      setOhlcv(data.ohlcv || {});
      setErrors(data.errors || {});
      setMaxFetchedDays(Math.max(days, 730));
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hydrated && tickerSet.length > 0 && Object.keys(ohlcv).length === 0 && !loading) {
      void refresh(tickerSet, maxRange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Add / remove / mutate charts ------------------------------------------------
  const addTicker = useCallback(
    (raw: string) => {
      const t = raw.trim().toUpperCase();
      if (!t) return;
      const exists = charts.some((c) => c.ticker === t);
      if (exists) return;
      const next: ChartState = { id: newId(), ticker: t, ...defaults };
      setCharts((cs) => [...cs, next]);
      setDraft('');
      const fetchDays = Math.max(maxFetchedDays, defaults.rangeDays || 730, 730);
      void refresh([...tickerSet, t], fetchDays);
    },
    [charts, defaults, maxFetchedDays, refresh, tickerSet],
  );

  const removeChart = useCallback((id: string) => {
    setCharts((cs) => cs.filter((c) => c.id !== id));
  }, []);

  const updateChart = useCallback((id: string, patch: Partial<ChartState>) => {
    setCharts((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const setChartRange = useCallback(
    (id: string, days: number) => {
      if (syncRanges) {
        setCharts((cs) => cs.map((c) => ({ ...c, rangeDays: days })));
      } else {
        updateChart(id, { rangeDays: days });
      }
    },
    [syncRanges, updateChart],
  );

  const addDrawing = useCallback(
    (id: string, drawing: ChartDrawing) => {
      setCharts((cs) =>
        cs.map((c) =>
          c.id === id
            ? { ...c, drawings: [...(c.drawings ?? []), drawing] }
            : c,
        ),
      );
    },
    [],
  );

  const clearDrawings = useCallback((id: string) => {
    setCharts((cs) => cs.map((c) => (c.id === id ? { ...c, drawings: [] } : c)));
  }, []);

  // Slice OHLCV by visible days for a single chart.
  const sliceRows = useCallback((rows: OHLCVRow[], days: number): OHLCVRow[] => {
    if (!rows || rows.length === 0) return rows;
    if (days <= 0) {
      const year = new Date().getUTCFullYear();
      return rows.filter((r) => Number(r.date.slice(0, 4)) >= year);
    }
    const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    return rows.filter((r) => r.date >= since);
  }, []);

  const presets = useMemo(() => [...BUILTIN_PRESETS, ...userPresets], [userPresets]);

  const applyPresetToAll = useCallback(
    (p: ChartPreset) => {
      setDefaults((d) => ({
        ...d,
        chartType: p.chartType,
        indicators: p.indicators,
        showVolume: p.showVolume,
        logScale: p.logScale ?? d.logScale,
      }));
      setCharts((cs) =>
        cs.map((c) => ({
          ...c,
          chartType: p.chartType,
          indicators: p.indicators,
          showVolume: p.showVolume,
          logScale: p.logScale ?? c.logScale,
        })),
      );
    },
    [],
  );

  const savePreset = useCallback(() => {
    const name = window.prompt('Preset name')?.trim();
    if (!name) return;
    const next: ChartPreset = {
      name,
      chartType: defaults.chartType,
      indicators: defaults.indicators,
      showVolume: defaults.showVolume,
      logScale: defaults.logScale,
    };
    setUserPresets((us) => [...us.filter((p) => p.name !== name), next]);
  }, [defaults]);

  const deletePreset = useCallback((name: string) => {
    setUserPresets((us) => us.filter((p) => p.name !== name));
  }, []);

  if (!hydrated) {
    return (
      <main className="px-3 py-3">
        <PageHeader title="CHARTS" />
        <div className="text-2xs uppercase text-zinc-500">Loading…</div>
      </main>
    );
  }

  const expandedChart = expanded ? charts.find((c) => c.id === expanded) : null;

  return (
    <main className="px-3 py-3">
      <PageHeader
        title="CHARTS"
        actions={
          <>
            <button
              onClick={() => void refresh(tickerSet, maxRange)}
              className="btn-secondary"
              disabled={loading}
              title="Refresh OHLCV"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> REFRESH
            </button>
          </>
        }
      />

      {/* Toolbar — defaults + add ticker */}
      <div className="mt-2 border border-border bg-panel p-2 space-y-2">
        <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-end">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-2xs uppercase tracking-widest text-zinc-500 mb-1">
              Add ticker
            </label>
            <TickerAutocomplete
              value={draft}
              onChange={(val, suggestion) => {
                if (suggestion) addTicker(suggestion.ticker);
                else setDraft(val);
              }}
              exchange={exchange}
              onExchangeChange={setExchange}
              showExchangeFilter
              placeholder="e.g. NVDA, AAPL"
            />
          </div>
          <button
            onClick={() => addTicker(draft)}
            disabled={!draft.trim()}
            className="btn-secondary"
          >
            <Plus size={11} /> ADD
          </button>
          <span className="text-2xs uppercase tracking-widest text-zinc-500 self-center md:self-end">
            {charts.length} CHARTS
          </span>
        </div>

        {/* Defaults toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-2">
          <span className="text-2xs uppercase tracking-widest text-zinc-500">Defaults</span>

          {/* Chart type */}
          <div className="flex items-center gap-1">
            {(['candlestick', 'ohlc', 'line', 'area'] as ChartType[]).map((t) => (
              <button
                key={t}
                onClick={() => setDefaults((d) => ({ ...d, chartType: t }))}
                className={`border px-1.5 py-0.5 text-2xs uppercase tracking-widest transition ${
                  defaults.chartType === t
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border text-zinc-500 hover:text-accent'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Indicators chips */}
          <div className="flex flex-wrap items-center gap-1">
            {ALL_INDICATORS.map((ind) => {
              const on = defaults.indicators.includes(ind.key);
              return (
                <button
                  key={ind.key}
                  onClick={() =>
                    setDefaults((d) => ({
                      ...d,
                      indicators: on
                        ? d.indicators.filter((k) => k !== ind.key)
                        : [...d.indicators, ind.key],
                    }))
                  }
                  className={`border px-1.5 py-0.5 text-2xs uppercase tracking-widest transition ${
                    on
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-border text-zinc-500 hover:text-accent'
                  }`}
                  title={ind.group}
                >
                  {ind.label}
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-1 text-2xs uppercase tracking-widest text-zinc-500">
            <input
              type="checkbox"
              checked={defaults.showVolume}
              onChange={(e) => setDefaults((d) => ({ ...d, showVolume: e.target.checked }))}
              className="accent-accent"
            />
            VOL
          </label>
          <label className="flex items-center gap-1 text-2xs uppercase tracking-widest text-zinc-500">
            <input
              type="checkbox"
              checked={defaults.logScale}
              onChange={(e) => setDefaults((d) => ({ ...d, logScale: e.target.checked }))}
              className="accent-accent"
            />
            LOG
          </label>

          {/* Apply to all */}
          <button
            onClick={() =>
              setCharts((cs) =>
                cs.map((c) => ({
                  ...c,
                  chartType: defaults.chartType,
                  indicators: defaults.indicators,
                  showVolume: defaults.showVolume,
                  logScale: defaults.logScale,
                })),
              )
            }
            className="btn-secondary"
            title="Apply current defaults to every chart"
          >
            APPLY TO ALL
          </button>
        </div>

        {/* Presets row */}
        <div className="flex flex-wrap items-center gap-1 border-t border-border pt-2">
          <span className="text-2xs uppercase tracking-widest text-zinc-500 mr-1">Presets</span>
          {presets.map((p) => (
            <span key={p.name} className="inline-flex items-center gap-1">
              <button
                onClick={() => applyPresetToAll(p)}
                className="border border-border bg-panel px-1.5 py-0.5 text-2xs uppercase tracking-widest text-zinc-300 hover:border-accent hover:text-accent"
                title={`${p.indicators.join(' · ')}`}
              >
                {p.name}
              </button>
              {!p.builtin && (
                <button
                  onClick={() => deletePreset(p.name)}
                  className="text-zinc-600 hover:text-neg"
                  title="Delete preset"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </span>
          ))}
          <button
            onClick={savePreset}
            className="btn-secondary ml-2"
            title="Save current defaults as a preset"
          >
            <Save size={11} /> SAVE
          </button>
        </div>

        {/* Global controls */}
        <div className="flex items-center justify-end gap-3 flex-wrap border-t border-border pt-2">
          <button
            onClick={() => setSyncRanges((s) => !s)}
            className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-2xs uppercase tracking-widest transition ${
              syncRanges
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border text-zinc-500 hover:text-accent'
            }`}
            title="When active, changing a chart's range updates every other chart."
          >
            <Link2 size={11} />
            {syncRanges ? 'RANGE SYNCED' : 'SYNC RANGES'}
          </button>
          <div className="flex items-center gap-1">
            <span className="text-2xs uppercase tracking-widest text-zinc-500 mr-1">Layout</span>
            <ColsButton active={layoutCols === 1} onClick={() => setLayoutCols(1)}>
              <Square size={11} />
            </ColsButton>
            <ColsButton active={layoutCols === 2} onClick={() => setLayoutCols(2)}>
              <Columns2 size={11} />
            </ColsButton>
            <ColsButton active={layoutCols === 3} onClick={() => setLayoutCols(3)}>
              <Columns3 size={11} />
            </ColsButton>
          </div>
        </div>
      </div>

      {generalError && (
        <div className="mt-2 border border-neg/60 bg-neg/10 px-2 py-1 text-2xs uppercase text-neg">
          {generalError}
        </div>
      )}

      {/* Charts grid */}
      <div
        className={`mt-2 grid gap-2 ${
          layoutCols === 1
            ? 'grid-cols-1'
            : layoutCols === 2
              ? 'grid-cols-1 lg:grid-cols-2'
              : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
        }`}
      >
        {charts.map((c) => {
          const fullRows = ohlcv[c.ticker] ?? [];
          const rows = sliceRows(fullRows, c.rangeDays);
          const overlayRows = c.compareTicker ? sliceRows(ohlcv[c.compareTicker] ?? [], c.rangeDays) : undefined;
          const err = errors[c.ticker];
          const settingsOpen = openSettings === c.id;
          return (
            <div key={c.id}>
              {fullRows.length === 0 && !err ? (
                <ChartSkeleton ticker={c.ticker} />
              ) : err ? (
                <div className="border border-neg/60 bg-neg/10 p-2 text-2xs uppercase text-neg">
                  <div className="font-bold">{c.ticker} · NO DATA</div>
                  <div className="mt-1 text-zinc-400 normal-case">{err}</div>
                  <button
                    className="mt-2 btn-secondary"
                    onClick={() => removeChart(c.id)}
                  >
                    REMOVE
                  </button>
                </div>
              ) : (
                <>
                  <ChartPro
                    ticker={c.ticker}
                    rows={rows}
                    chartType={c.chartType}
                    indicators={c.indicators}
                    showVolume={c.showVolume}
                    logScale={c.logScale}
                    overlayTicker={c.compareTicker}
                    overlayRows={overlayRows}
                    drawings={c.drawings}
                    onAddDrawing={(d) => addDrawing(c.id, d)}
                    rangeDays={c.rangeDays}
                    onRangeChange={(d) => setChartRange(c.id, d)}
                    onExpand={() => setExpanded(c.id)}
                    onRemove={() => removeChart(c.id)}
                    onSettings={() => setOpenSettings(settingsOpen ? null : c.id)}
                    settingsOpen={settingsOpen}
                  />
                  {settingsOpen && (
                    <ChartSettingsPanel
                      state={c}
                      onChange={(patch) => updateChart(c.id, patch)}
                      onClear={() => clearDrawings(c.id)}
                      onClose={() => setOpenSettings(null)}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Expand modal — full-screen single chart */}
      {expandedChart && (
        <div
          className="fixed inset-0 z-40 flex flex-col bg-black"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setExpanded(null);
          }}
        >
          <div className="flex items-center justify-between border-b border-border bg-black px-3 py-1.5">
            <span className="text-2xs font-bold uppercase tracking-widest text-accent">
              EXPAND · {expandedChart.ticker}
            </span>
            <button
              onClick={() => setExpanded(null)}
              className="btn-secondary"
              title="Close (Esc)"
            >
              ✕ CLOSE
            </button>
          </div>
          <div className="flex-1 overflow-auto p-2">
            <ChartPro
              ticker={expandedChart.ticker}
              rows={sliceRows(ohlcv[expandedChart.ticker] ?? [], expandedChart.rangeDays)}
              chartType={expandedChart.chartType}
              indicators={expandedChart.indicators}
              showVolume={expandedChart.showVolume}
              logScale={expandedChart.logScale}
              overlayTicker={expandedChart.compareTicker}
              overlayRows={
                expandedChart.compareTicker
                  ? sliceRows(ohlcv[expandedChart.compareTicker] ?? [], expandedChart.rangeDays)
                  : undefined
              }
              drawings={expandedChart.drawings}
              onAddDrawing={(d) => addDrawing(expandedChart.id, d)}
              height={Math.max(560, typeof window !== 'undefined' ? window.innerHeight - 120 : 600)}
              rangeDays={expandedChart.rangeDays}
              onRangeChange={(d) => setChartRange(expandedChart.id, d)}
            />
          </div>
        </div>
      )}
    </main>
  );
}

function ColsButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`border px-1.5 py-0.5 text-2xs transition ${
        active
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-border text-zinc-500 hover:text-accent'
      }`}
    >
      {children}
    </button>
  );
}

function ChartSettingsPanel({
  state,
  onChange,
  onClear,
  onClose,
}: {
  state: ChartState;
  onChange: (patch: Partial<ChartState>) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (ref.current?.contains(target)) return;
      if (target.closest('[data-chart-settings-toggle]')) return;
      onClose();
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="mt-1 border border-border bg-panel p-2 space-y-2"
    >
      <div className="flex items-center gap-2">
        <span className="text-2xs font-bold uppercase tracking-widest text-accent">
          ⚙ {state.ticker}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <span className="text-2xs uppercase tracking-widest text-zinc-500 mr-1">Type</span>
        {(['candlestick', 'ohlc', 'line', 'area'] as ChartType[]).map((t) => (
          <button
            key={t}
            onClick={() => onChange({ chartType: t })}
            className={`border px-1.5 py-0.5 text-2xs uppercase tracking-widest ${
              state.chartType === t
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border text-zinc-500 hover:text-accent'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <span className="text-2xs uppercase tracking-widest text-zinc-500 mr-1">Indicators</span>
        {ALL_INDICATORS.map((ind) => {
          const on = state.indicators.includes(ind.key);
          return (
            <button
              key={ind.key}
              onClick={() =>
                onChange({
                  indicators: on
                    ? state.indicators.filter((k) => k !== ind.key)
                    : [...state.indicators, ind.key],
                })
              }
              className={`border px-1.5 py-0.5 text-2xs uppercase tracking-widest ${
                on
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border text-zinc-500 hover:text-accent'
              }`}
            >
              {ind.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1 text-2xs uppercase tracking-widest text-zinc-500">
          <input
            type="checkbox"
            checked={state.showVolume}
            onChange={(e) => onChange({ showVolume: e.target.checked })}
            className="accent-accent"
          />
          VOL
        </label>
        <label className="flex items-center gap-1 text-2xs uppercase tracking-widest text-zinc-500">
          <input
            type="checkbox"
            checked={state.logScale}
            onChange={(e) => onChange({ logScale: e.target.checked })}
            className="accent-accent"
          />
          LOG
        </label>

        <div className="flex items-center gap-1">
          <span className="text-2xs uppercase tracking-widest text-zinc-500">Compare</span>
          <input
            type="text"
            placeholder="vs (e.g. SPY)"
            value={state.compareTicker ?? ''}
            onChange={(e) =>
              onChange({ compareTicker: e.target.value.toUpperCase() || undefined })
            }
            className="input-field w-[120px]"
          />
        </div>

        {(state.drawings?.length ?? 0) > 0 && (
          <button onClick={onClear} className="btn-secondary" title="Clear drawings">
            <Trash2 size={11} /> CLEAR DRAWINGS ({state.drawings?.length})
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <span className="text-2xs uppercase tracking-widest text-zinc-500 mr-1">Range</span>
        {RANGE_PRESETS.map((p) => {
          const on = state.rangeDays === p.days;
          return (
            <button
              key={p.label}
              onClick={() => onChange({ rangeDays: p.days })}
              className={`border px-1.5 py-0.5 text-2xs uppercase tracking-widest ${
                on
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border text-zinc-500 hover:text-accent'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChartSkeleton({ ticker }: { ticker: string }) {
  return (
    <div className="border border-border bg-panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-2 py-1">
        <span className="font-mono text-xs font-bold uppercase text-accent">{ticker}</span>
        <span className="text-2xs uppercase tracking-widest text-zinc-500">
          <RefreshCw size={10} className="inline animate-spin" /> LOADING
        </span>
      </div>
      <div className="relative h-[260px]" style={{ background: 'linear-gradient(180deg, rgba(127,127,127,0.03) 0%, rgba(127,127,127,0.08) 100%)' }}>
        <svg viewBox="0 0 600 220" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-40">
          {Array.from({ length: 36 }).map((_, i) => {
            const x = 12 + i * 16;
            const baseY = 80 + Math.sin(i / 3) * 25 + Math.cos(i / 7) * 18;
            const top = baseY - 22 - (i % 5) * 3;
            const bot = baseY + 22 + (i % 4) * 3;
            return (
              <g key={i}>
                <line x1={x} x2={x} y1={top - 6} y2={bot + 6} stroke="#3a3a3f" strokeWidth="0.6" />
                <rect x={x - 3} y={top} width="6" height={Math.max(4, bot - top)} fill="#3a3a3f" opacity="0.7" />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
