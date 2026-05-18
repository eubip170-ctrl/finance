'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Customized,
} from 'recharts';
import {
  type OHLCVRow,
  sma,
  ema,
  rsi as rsiFn,
  bbands,
  macd as macdFn,
  atr as atrFn,
  obv as obvFn,
  vwap as vwapFn,
  detectSRLevels,
  pluck,
} from '@/lib/charts/technicals';
import { CATALOG_NAME_BY_TICKER } from '@/lib/charts/benchmarkCatalog';

/* ========= Types ========= */

export type ChartType = 'candlestick' | 'ohlc' | 'line' | 'area';

export type Indicator =
  | 'SMA8'
  | 'SMA20'
  | 'SMA50'
  | 'SMA200'
  | 'EMA21'
  | 'BB'
  | 'VWAP'
  | 'SR'
  | 'RSI'
  | 'MACD'
  | 'ATR'
  | 'OBV';

export type ChartDrawing =
  | { id: string; type: 'trendline'; from: { date: string; price: number }; to: { date: string; price: number }; color?: string }
  | { id: string; type: 'fib';       from: { date: string; price: number }; to: { date: string; price: number }; color?: string }
  | { id: string; type: 'vertical';  date: string; label?: string; color?: string };

export type DrawingTool = 'none' | 'trendline' | 'fib' | 'vertical';

export interface ChartProProps {
  ticker: string;
  rows: OHLCVRow[];
  chartType?: ChartType;
  indicators?: Indicator[];
  showVolume?: boolean;
  logScale?: boolean;
  height?: number;
  compact?: boolean;
  onExpand?: () => void;
  onClose?: () => void;
  onRemove?: () => void;
  onSettings?: () => void;
  settingsOpen?: boolean;
  overlayTicker?: string;
  overlayRows?: OHLCVRow[];
  levels?: number[];
  onDragStart?: (e: React.DragEvent) => void;
  onDownload?: () => void;
  drawings?: ChartDrawing[];
  onAddDrawing?: (d: ChartDrawing) => void;
  rangeDays?: number;
  onRangeChange?: (days: number) => void;
}

const RANGE_PRESETS: Array<{ label: string; days: number }> = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: 'YTD', days: 0 },
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
  { label: '5Y', days: 1825 },
];

const COLORS = {
  up: '#26A69A',
  down: '#EF5350',
  sma8: '#F6BE00',
  sma20: '#42A5F5',
  sma50: '#AB47BC',
  sma200: '#EF6C00',
  ema21: '#26C6DA',
  bb: '#7E57C2',
  vwap: '#E040FB',
  rsi: '#8E5CF7',
  macdLine: '#42A5F5',
  macdSignal: '#FF9800',
  obv: '#00BCD4',
  atr: '#FFB74D',
  axis: 'rgb(var(--chart-axis))',
  grid: 'rgb(var(--chart-grid))',
  tick: 'rgb(var(--chart-tick))',
  card: 'rgb(var(--color-card))',
  body: 'rgb(var(--color-body))',
  heading: 'rgb(var(--color-heading))',
  muted: 'rgb(var(--color-muted))',
  border: 'rgb(var(--color-border))',
};

function fmtPx(v: number) {
  if (!isFinite(v)) return '—';
  if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (v >= 100) return v.toFixed(2);
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(4);
}
function fmtVol(v: number) {
  if (!isFinite(v) || v === 0) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}
function fmtPct(v: number) {
  if (!isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

interface CandleLayerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

function CandleLayer(props: CandleLayerProps) {
  const { xAxisMap, yAxisMap, formattedGraphicalItems, offset } = props;
  if (!formattedGraphicalItems || formattedGraphicalItems.length === 0) return null;
  const item = formattedGraphicalItems[0];
  if (!item) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = item.props?.data || [];
  if (data.length === 0) return null;

  const xKey = Object.keys(xAxisMap)[0];
  const yKey = Object.keys(yAxisMap).find((k) => yAxisMap[k]?.orientation === 'right') || Object.keys(yAxisMap)[0];
  const xAxis = xAxisMap[xKey];
  const yAxis = yAxisMap[yKey];
  if (!xAxis || !yAxis || !yAxis.scale || !xAxis.scale) return null;

  const bandWidth =
    typeof xAxis.scale.bandwidth === 'function'
      ? xAxis.scale.bandwidth()
      : Math.max(2, (offset?.width ?? 600) / Math.max(1, data.length));
  const candleW = Math.max(1.5, Math.min(10, bandWidth * 0.6));

  return (
    <g pointerEvents="none">
      {data.map((d, i) => {
        const o = d.open;
        const c = d.close;
        const h = d.high;
        const l = d.low;
        if (!isFinite(o) || !isFinite(c) || !isFinite(h) || !isFinite(l)) return null;
        const cx = xAxis.scale(d.date);
        if (cx == null) return null;
        const yO = yAxis.scale(o);
        const yC = yAxis.scale(c);
        const yH = yAxis.scale(h);
        const yL = yAxis.scale(l);
        const up = c >= o;
        const color = up ? COLORS.up : COLORS.down;
        const yTop = Math.min(yO, yC);
        const bodyH = Math.max(0.5, Math.abs(yC - yO));
        return (
          <g key={i}>
            <line x1={cx} x2={cx} y1={yH} y2={yL} stroke={color} strokeWidth={1} />
            <rect
              x={cx - candleW / 2}
              y={yTop}
              width={candleW}
              height={bodyH}
              fill={color}
              stroke={color}
            />
          </g>
        );
      })}
    </g>
  );
}

function OHLCLayer(props: CandleLayerProps) {
  const { xAxisMap, yAxisMap, formattedGraphicalItems, offset } = props;
  if (!formattedGraphicalItems || formattedGraphicalItems.length === 0) return null;
  const item = formattedGraphicalItems[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = item?.props?.data || [];
  if (data.length === 0) return null;
  const xKey = Object.keys(xAxisMap)[0];
  const yKey = Object.keys(yAxisMap)[0];
  const xAxis = xAxisMap[xKey];
  const yAxis = yAxisMap[yKey];
  if (!xAxis || !yAxis) return null;
  const bandWidth =
    typeof xAxis.scale.bandwidth === 'function'
      ? xAxis.scale.bandwidth()
      : Math.max(2, (offset?.width ?? 600) / Math.max(1, data.length));
  const tickW = Math.max(1.5, bandWidth * 0.4);
  return (
    <g pointerEvents="none">
      {data.map((d, i) => {
        const o = d.open;
        const c = d.close;
        const h = d.high;
        const l = d.low;
        if (!isFinite(o) || !isFinite(c) || !isFinite(h) || !isFinite(l)) return null;
        const cx = xAxis.scale(d.date);
        if (cx == null) return null;
        const yO = yAxis.scale(o);
        const yC = yAxis.scale(c);
        const yH = yAxis.scale(h);
        const yL = yAxis.scale(l);
        const up = c >= o;
        const color = up ? COLORS.up : COLORS.down;
        return (
          <g key={i} stroke={color}>
            <line x1={cx} x2={cx} y1={yH} y2={yL} strokeWidth={1} />
            <line x1={cx - tickW} x2={cx} y1={yO} y2={yO} strokeWidth={1} />
            <line x1={cx} x2={cx + tickW} y1={yC} y2={yC} strokeWidth={1} />
          </g>
        );
      })}
    </g>
  );
}

export function ChartPro({
  ticker,
  rows,
  chartType = 'candlestick',
  indicators = ['SMA20', 'SMA50', 'BB'],
  showVolume = true,
  logScale = false,
  height,
  compact = false,
  onExpand,
  onClose,
  onRemove,
  onSettings,
  settingsOpen = false,
  overlayTicker,
  overlayRows,
  levels,
  onDragStart,
  onDownload,
  drawings,
  onAddDrawing,
  rangeDays,
  onRangeChange,
}: ChartProProps) {
  const [hover, setHover] = useState<number | null>(null);

  const [viewWindow, setViewWindow] = useState<{ from: number; to: number } | null>(null);
  const [yDomain, setYDomain] = useState<[number, number] | null>(null);
  const [dragType, setDragType] = useState<'pan' | 'zoomY' | 'zoomX' | 'select' | null>(null);
  const [hoverRegion, setHoverRegion] = useState<'body' | 'yAxis' | 'xAxis' | null>(null);
  const [selectRect, setSelectRect] = useState<{ x1: number; x2: number } | null>(null);
  const [activeTool, setActiveTool] = useState<DrawingTool>('none');
  const [drawAnchor, setDrawAnchor] = useState<{ date: string; price: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    type: 'pan' | 'zoomY' | 'zoomX' | 'select';
    startX: number;
    startY: number;
    startWindow: { from: number; to: number };
    startYDomain: [number, number] | null;
    width: number;
    height: number;
    rectLeft: number;
    rectTop: number;
  } | null>(null);

  const closes = useMemo(() => pluck(rows, 'close'), [rows]);

  const computed = useMemo(() => {
    const r: Record<string, number[]> = {};
    if (indicators.includes('SMA8')) r.SMA8 = sma(closes, 8);
    if (indicators.includes('SMA20')) r.SMA20 = sma(closes, 20);
    if (indicators.includes('SMA50')) r.SMA50 = sma(closes, 50);
    if (indicators.includes('SMA200')) r.SMA200 = sma(closes, 200);
    if (indicators.includes('EMA21')) r.EMA21 = ema(closes, 21);
    if (indicators.includes('BB')) {
      const bb = bbands(closes, 20, 2);
      r.BB_U = bb.upper;
      r.BB_M = bb.mid;
      r.BB_L = bb.lower;
    }
    if (indicators.includes('VWAP')) r.VWAP = vwapFn(rows);
    if (indicators.includes('RSI')) r.RSI = rsiFn(closes, 14);
    if (indicators.includes('MACD')) {
      const m = macdFn(closes, 12, 26, 9);
      r.MACD_L = m.line;
      r.MACD_S = m.signal;
      r.MACD_H = m.hist;
    }
    if (indicators.includes('ATR')) r.ATR = atrFn(rows, 14);
    if (indicators.includes('OBV')) r.OBV = obvFn(rows);
    return r;
  }, [closes, rows, indicators]);

  const overlayMap = useMemo(() => {
    if (!overlayRows || overlayRows.length === 0) return null;
    const m = new Map<string, number>();
    for (const r of overlayRows) {
      if (Number.isFinite(r.close)) m.set(r.date, r.close);
    }
    return m;
  }, [overlayRows]);

  const overlayAnchor = useMemo(() => {
    if (!overlayMap) return null;
    for (const row of rows) {
      const ov = overlayMap.get(row.date);
      if (Number.isFinite(ov) && Number.isFinite(row.close) && row.close > 0 && (ov as number) > 0) {
        return { mainPx: row.close, overlayPx: ov as number };
      }
    }
    return null;
  }, [rows, overlayMap]);

  const data = useMemo(() => {
    return rows.map((row, i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const o: any = { ...row };
      o.volColor = row.close >= row.open ? COLORS.up : COLORS.down;
      for (const k of Object.keys(computed)) o[k] = computed[k][i];
      if (overlayMap && overlayAnchor) {
        const ov = overlayMap.get(row.date);
        o.overlay = Number.isFinite(ov)
          ? (ov as number) * (overlayAnchor.mainPx / overlayAnchor.overlayPx)
          : null;
      }
      return o;
    });
  }, [rows, computed, overlayMap, overlayAnchor]);

  const srLevels = useMemo(
    () => (indicators.includes('SR') ? detectSRLevels(closes, 8, 6) : []),
    [closes, indicators],
  );

  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const dayChange = last && prev ? last.close - prev.close : 0;
  const dayChangePct = last && prev && prev.close > 0
    ? ((last.close / prev.close - 1) * 100)
    : 0;
  const periodPct =
    rows.length > 1 && rows[0].close > 0
      ? (rows[rows.length - 1].close / rows[0].close - 1) * 100
      : 0;

  const overlayPeriodPct = useMemo(() => {
    if (!overlayMap || rows.length < 2) return null;
    let first: number | null = null;
    let lastV: number | null = null;
    for (const row of rows) {
      const v = overlayMap.get(row.date);
      if (Number.isFinite(v)) {
        if (first === null) first = v as number;
        lastV = v as number;
      }
    }
    if (first === null || lastV === null || first <= 0) return null;
    return (lastV / first - 1) * 100;
  }, [overlayMap, rows]);

  const wantRSI = indicators.includes('RSI') && !compact;
  const wantMACD = indicators.includes('MACD') && !compact;
  const wantATR = indicators.includes('ATR') && !compact;
  const wantOBV = indicators.includes('OBV') && !compact;

  const priceHeight = height
    ? Math.max(220, Math.round(height * 0.55))
    : compact
      ? 180
      : 380;
  const subHeight = compact ? 0 : 110;

  const hovered = hover != null && hover >= 0 && hover < rows.length ? rows[hover] : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleHover = (e: any) => {
    const idx = e?.activeTooltipIndex;
    setHover(typeof idx === 'number' ? idx : null);
  };
  const handleLeave = () => setHover(null);

  const effectiveData = useMemo(() => {
    if (!viewWindow) return data;
    const total = data.length;
    if (total === 0) return data;

    let stepMs = 86_400_000;
    if (total >= 2) {
      const sample = Math.min(5, total - 1);
      const t1 = new Date(data[total - 1].date).getTime();
      const t0 = new Date(data[total - 1 - sample].date).getTime();
      const dt = (t1 - t0) / sample;
      if (Number.isFinite(dt) && dt > 0) stepMs = dt;
    }
    const lastT = new Date(data[total - 1].date).getTime();
    const firstT = new Date(data[0].date).getTime();

    const out: typeof data = [];
    for (let i = viewWindow.from; i <= viewWindow.to; i++) {
      if (i >= 0 && i < total) {
        out.push(data[i]);
      } else if (i >= total) {
        const futureDate = new Date(lastT + (i - (total - 1)) * stepMs)
          .toISOString()
          .slice(0, 10);
        out.push({ date: futureDate } as unknown as (typeof data)[number]);
      } else {
        const pastDate = new Date(firstT + i * stepMs).toISOString().slice(0, 10);
        out.push({ date: pastDate } as unknown as (typeof data)[number]);
      }
    }
    return out;
  }, [data, viewWindow]);

  const firstDate = rows[0]?.date;
  const lastDate = rows[rows.length - 1]?.date;
  useEffect(() => {
    setViewWindow(null);
    setYDomain(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstDate, lastDate]);

  const Y_AXIS_W = 48;
  const X_AXIS_H = 22;
  const MIN_VISIBLE = 12;

  const computeVisibleYBounds = useCallback((): [number, number] | null => {
    let lo = Infinity, hi = -Infinity;
    for (const r of effectiveData) {
      if (Number.isFinite(r.low)) lo = Math.min(lo, r.low as number);
      if (Number.isFinite(r.high)) hi = Math.max(hi, r.high as number);
      if (Number.isFinite(r.overlay)) {
        lo = Math.min(lo, r.overlay as number);
        hi = Math.max(hi, r.overlay as number);
      }
    }
    if (!isFinite(lo) || !isFinite(hi) || lo === hi) return null;
    const margin = (hi - lo) * 0.04;
    return [lo - margin, hi + margin];
  }, [effectiveData]);

  const clampWindow = useCallback(
    (w: { from: number; to: number }): { from: number; to: number } => {
      const total = rows.length;
      const MAX_LEN_OVER = Math.max(MIN_VISIBLE, total + Math.floor(total * 0.6));
      let len = w.to - w.from + 1;
      len = Math.max(MIN_VISIBLE, Math.min(MAX_LEN_OVER, len));
      let from = w.from;
      let to = from + len - 1;
      if (total === 0) return { from: 0, to: len - 1 };
      if (from > total - MIN_VISIBLE) {
        from = total - MIN_VISIBLE;
        to = from + len - 1;
      }
      if (to < MIN_VISIBLE - 1) {
        to = MIN_VISIBLE - 1;
        from = to - len + 1;
      }
      return { from, to };
    },
    [rows.length],
  );

  const pixelToDataPoint = useCallback(
    (localX: number, localY: number): { date: string; price: number } | null => {
      if (effectiveData.length === 0) return null;
      const usableW = Math.max(1, (wrapperRef.current?.clientWidth ?? 800) - Y_AXIS_W);
      const idx = Math.max(
        0,
        Math.min(effectiveData.length - 1, Math.round((localX / usableW) * (effectiveData.length - 1))),
      );
      const date = effectiveData[idx].date;
      const bounds = yDomain ?? computeVisibleYBounds();
      if (!bounds) return null;
      const [lo, hi] = bounds;
      const topMargin = 6;
      const xAxisH = compact ? 0 : 18;
      const plotTop = topMargin;
      const plotBottom = priceHeight - xAxisH;
      const t = Math.max(0, Math.min(1, (localY - plotTop) / Math.max(1, plotBottom - plotTop)));
      const price = hi - t * (hi - lo);
      return { date, price };
    },
    [compact, computeVisibleYBounds, effectiveData, priceHeight, yDomain],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (rows.length < 2 || !wrapperRef.current) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-no-pan]')) return;
      if (e.button !== 0) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;

      if (activeTool !== 'none') {
        const dp = pixelToDataPoint(localX, localY);
        if (!dp) return;
        if (activeTool === 'vertical') {
          const drawing: ChartDrawing = {
            id: `dr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'vertical',
            date: dp.date,
            color: '#FFB300',
          };
          onAddDrawing?.(drawing);
          setActiveTool('none');
          e.preventDefault();
          return;
        }
        if (!drawAnchor) {
          setDrawAnchor(dp);
        } else {
          const drawing: ChartDrawing =
            activeTool === 'fib'
              ? {
                  id: `dr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  type: 'fib',
                  from: drawAnchor,
                  to: dp,
                  color: '#42A5F5',
                }
              : {
                  id: `dr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  type: 'trendline',
                  from: drawAnchor,
                  to: dp,
                  color: '#26A69A',
                };
          onAddDrawing?.(drawing);
          setDrawAnchor(null);
          setActiveTool('none');
        }
        e.preventDefault();
        return;
      }

      const onYAxis = localX >= rect.width - Y_AXIS_W;
      const onXAxis = !onYAxis && localY >= rect.height - X_AXIS_H && !compact;
      const startWindow = viewWindow ?? { from: 0, to: rows.length - 1 };
      const startYDomain = onYAxis ? (yDomain ?? computeVisibleYBounds()) : yDomain;
      if (onYAxis && !startYDomain) return;
      const bodyType = viewWindow ? 'pan' : 'select';
      const type: 'pan' | 'zoomY' | 'zoomX' | 'select' = onYAxis
        ? 'zoomY'
        : onXAxis
          ? 'zoomX'
          : bodyType;
      dragRef.current = {
        type,
        startX: e.clientX,
        startY: e.clientY,
        startWindow,
        startYDomain,
        width: rect.width,
        height: rect.height,
        rectLeft: rect.left,
        rectTop: rect.top,
      };
      setDragType(type);
      if (type === 'select') {
        setSelectRect({ x1: localX, x2: localX });
      }
      if (onYAxis && startYDomain && !yDomain) setYDomain(startYDomain);
      e.preventDefault();
    },
    [activeTool, compact, computeVisibleYBounds, drawAnchor, onAddDrawing, pixelToDataPoint, rows.length, viewWindow, yDomain],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (drawAnchor) setDrawAnchor(null);
        else if (activeTool !== 'none') setActiveTool('none');
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeTool, drawAnchor]);

  useEffect(() => {
    function move(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (d.type === 'pan') {
        const len = d.startWindow.to - d.startWindow.from + 1;
        const indexShift = Math.round((-dx / Math.max(1, d.width - Y_AXIS_W)) * len);
        setViewWindow(clampWindow({
          from: d.startWindow.from + indexShift,
          to: d.startWindow.to + indexShift,
        }));
      } else if (d.type === 'zoomX') {
        const factor = Math.exp(-dx / 220);
        const len = d.startWindow.to - d.startWindow.from + 1;
        const newLen = Math.max(
          MIN_VISIBLE,
          Math.min(rows.length + Math.floor(rows.length * 0.6), Math.round(len * factor)),
        );
        const center = (d.startWindow.from + d.startWindow.to) / 2;
        const from = Math.round(center - newLen / 2);
        setViewWindow(clampWindow({ from, to: from + newLen - 1 }));
      } else if (d.type === 'zoomY' && d.startYDomain) {
        const factor = Math.exp(dy / 220);
        const [lo, hi] = d.startYDomain;
        const center = (lo + hi) / 2;
        const half = ((hi - lo) / 2) * factor;
        setYDomain([center - half, center + half]);
      } else if (d.type === 'select') {
        const x = Math.max(0, Math.min(d.width - Y_AXIS_W, e.clientX - d.rectLeft));
        const x1 = Math.max(0, Math.min(d.width - Y_AXIS_W, d.startX - d.rectLeft));
        setSelectRect({ x1, x2: x });
      }
    }
    function up(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      if (d.type === 'select') {
        const x1 = Math.min(d.startX, e.clientX);
        const x2 = Math.max(d.startX, e.clientX);
        const usableW = Math.max(1, d.width - Y_AXIS_W);
        const lhs = Math.max(0, Math.min(usableW, x1 - d.rectLeft));
        const rhs = Math.max(0, Math.min(usableW, x2 - d.rectLeft));
        const total = rows.length;
        const idxFrom = Math.round((lhs / usableW) * (total - 1));
        const idxTo = Math.round((rhs / usableW) * (total - 1));
        if (idxTo - idxFrom + 1 >= MIN_VISIBLE) {
          setViewWindow(clampWindow({ from: idxFrom, to: idxTo }));
        }
        setSelectRect(null);
      }
      dragRef.current = null;
      setDragType(null);
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
  }, [clampWindow, rows.length]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    function handler(e: WheelEvent) {
      if (rows.length < 2) return;
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const onYAxis = localX >= rect.width - Y_AXIS_W;
      const onXAxis = !onYAxis && localY >= rect.height - X_AXIS_H && !compact;

      if (onYAxis) {
        const dom = yDomain ?? computeVisibleYBounds();
        if (!dom) return;
        const factor = e.deltaY > 0 ? 1.18 : 1 / 1.18;
        const [lo, hi] = dom;
        const center = (lo + hi) / 2;
        const half = ((hi - lo) / 2) * factor;
        setYDomain([center - half, center + half]);
        return;
      }

      void onXAxis;

      const w = viewWindow ?? { from: 0, to: rows.length - 1 };
      const len = w.to - w.from + 1;
      const factor = e.deltaY > 0 ? 1.18 : 1 / 1.18;
      const newLen = Math.max(
        MIN_VISIBLE,
        Math.min(rows.length + Math.floor(rows.length * 0.6), Math.round(len * factor)),
      );
      const usableW = Math.max(1, rect.width - Y_AXIS_W);
      const mouseRel = Math.max(0, Math.min(1, localX / usableW));
      const dataAtMouse = w.from + mouseRel * (len - 1);
      const newFrom = Math.round(dataAtMouse - mouseRel * (newLen - 1));
      setViewWindow(clampWindow({ from: newFrom, to: newFrom + newLen - 1 }));
    }
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [clampWindow, compact, computeVisibleYBounds, rows.length, viewWindow, yDomain]);

  function resetView() {
    setViewWindow(null);
    setYDomain(null);
  }

  const zoomBy = useCallback(
    (factor: number) => {
      if (rows.length < 2) return;
      const w = viewWindow ?? { from: 0, to: rows.length - 1 };
      const len = w.to - w.from + 1;
      const newLen = Math.max(
        MIN_VISIBLE,
        Math.min(rows.length + Math.floor(rows.length * 0.6), Math.round(len * factor)),
      );
      const mid = (w.from + w.to) / 2;
      const from = Math.round(mid - newLen / 2);
      setViewWindow(clampWindow({ from, to: from + newLen - 1 }));
    },
    [clampWindow, rows.length, viewWindow],
  );

  const isCustomView = viewWindow !== null || yDomain !== null;
  const visibleBars = viewWindow ? viewWindow.to - viewWindow.from + 1 : rows.length;
  const cursorStyle =
    activeTool !== 'none'
      ? 'crosshair'
      : dragType === 'pan'
        ? 'grabbing'
        : dragType === 'zoomY'
          ? 'ns-resize'
          : dragType === 'zoomX'
            ? 'ew-resize'
            : dragType === 'select'
              ? 'crosshair'
              : hoverRegion === 'yAxis'
                ? 'ns-resize'
                : hoverRegion === 'xAxis'
                  ? 'ew-resize'
                  : viewWindow
                    ? 'grab'
                    : 'crosshair';

  const handleRegionMove = useCallback(
    (e: React.MouseEvent) => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const onY = x >= rect.width - Y_AXIS_W;
      const onX = !onY && y >= rect.height - X_AXIS_H && !compact;
      const next: 'body' | 'yAxis' | 'xAxis' = onY ? 'yAxis' : onX ? 'xAxis' : 'body';
      setHoverRegion(prev => (prev === next ? prev : next));
    },
    [compact],
  );

  const onDoubleClickRegion = useCallback(
    (e: React.MouseEvent) => {
      if (!wrapperRef.current) {
        resetView();
        return;
      }
      const rect = wrapperRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const onY = x >= rect.width - Y_AXIS_W;
      const onX = !onY && y >= rect.height - X_AXIS_H && !compact;
      if (onY) setYDomain(null);
      else if (onX) setViewWindow(null);
      else resetView();
    },
    [compact],
  );

  return (
    <div
      className="rounded-card border border-border bg-card overflow-hidden flex flex-col"
      style={{ background: COLORS.card }}
    >
      <div
        className="flex items-center justify-between gap-3 px-3 py-2 border-b"
        style={{ borderColor: COLORS.border }}
      >
        <div className="flex items-baseline gap-3 flex-wrap min-w-0">
          <span className="font-mono font-extrabold tabular-nums tracking-tight" style={{ color: COLORS.heading, fontSize: compact ? '0.85rem' : '1rem' }}>
            {ticker}
          </span>
          {!compact && CATALOG_NAME_BY_TICKER[ticker] && (
            <span
              className="text-[0.72rem] truncate"
              style={{ color: COLORS.muted }}
              title={CATALOG_NAME_BY_TICKER[ticker]}
            >
              · {CATALOG_NAME_BY_TICKER[ticker]}
            </span>
          )}
          {last && (
            <>
              <span className="font-mono font-bold tabular-nums" style={{ color: COLORS.heading, fontSize: compact ? '0.85rem' : '1rem' }}>
                {fmtPx(last.close)}
              </span>
              <span
                className="font-mono font-semibold tabular-nums text-[0.78rem]"
                style={{ color: dayChange >= 0 ? COLORS.up : COLORS.down }}
              >
                {dayChange >= 0 ? '+' : ''}
                {dayChange.toFixed(2)} · {fmtPct(dayChangePct)}
              </span>
            </>
          )}
          {!compact && rows.length > 1 && (
            <span
              className="font-mono tabular-nums text-[0.7rem] px-1.5 py-0.5 rounded"
              style={{
                color: periodPct >= 0 ? COLORS.up : COLORS.down,
                background: periodPct >= 0 ? 'rgba(38,166,154,0.10)' : 'rgba(239,83,80,0.10)',
              }}
              title={`${rows[0].date} → ${rows[rows.length - 1].date}`}
            >
              Period {fmtPct(periodPct)}
            </span>
          )}
          {overlayTicker && overlayPeriodPct != null && (
            <span
              className="font-mono tabular-nums text-[0.7rem] px-1.5 py-0.5 rounded"
              style={{
                color: COLORS.vwap,
                background: 'rgba(224,64,251,0.10)',
                border: `1px solid ${COLORS.vwap}55`,
              }}
              title="Compare overlay (rebased)"
            >
              vs {overlayTicker} {fmtPct(overlayPeriodPct)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hovered && !compact && (
            <span className="font-mono tabular-nums text-[0.66rem] hidden md:inline" style={{ color: COLORS.muted }}>
              {hovered.date} · O {fmtPx(hovered.open)} · H {fmtPx(hovered.high)} · L {fmtPx(hovered.low)} · C {fmtPx(hovered.close)} · V {fmtVol(hovered.volume)}
            </span>
          )}
          {onDragStart && (
            <button
              draggable
              onDragStart={onDragStart}
              className="cursor-move text-[0.7rem] px-2 py-0.5 rounded border transition select-none"
              style={{ color: COLORS.muted, borderColor: COLORS.border }}
              title="Drag to reorder"
            >
              ≡
            </button>
          )}
          {onDownload && (
            <button
              onClick={onDownload}
              className="text-[0.7rem] px-2 py-0.5 rounded border transition"
              style={{ color: COLORS.muted, borderColor: COLORS.border }}
              title="Download PNG"
            >
              ↓
            </button>
          )}
          {onSettings && (
            <button
              data-chart-settings-toggle
              onClick={onSettings}
              className="text-[0.7rem] px-2 py-0.5 rounded border transition"
              style={{
                color: settingsOpen ? COLORS.heading : COLORS.muted,
                borderColor: settingsOpen ? COLORS.heading : COLORS.border,
                background: settingsOpen ? 'rgba(127,127,127,0.08)' : undefined,
              }}
              title={settingsOpen ? 'Close settings' : 'Chart settings'}
            >
              ⚙
            </button>
          )}
          {onExpand && (
            <button
              onClick={onExpand}
              className="text-[0.7rem] px-2 py-0.5 rounded border transition"
              style={{ color: COLORS.muted, borderColor: COLORS.border }}
              title="Expand"
            >
              ⛶
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-[0.7rem] px-2 py-0.5 rounded border transition"
              style={{ color: COLORS.muted, borderColor: COLORS.border }}
              title="Close"
            >
              ✕
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              className="text-[0.7rem] px-2 py-0.5 rounded border transition"
              style={{ color: COLORS.muted, borderColor: COLORS.border }}
              title="Remove"
            >
              −
            </button>
          )}
        </div>
      </div>

      <div
        ref={wrapperRef}
        className="px-1 relative select-none"
        onMouseDownCapture={onMouseDown}
        onMouseMove={handleRegionMove}
        onMouseLeave={() => setHoverRegion(null)}
        onDoubleClick={onDoubleClickRegion}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: cursorStyle, touchAction: 'none' }}
      >
        {(hoverRegion === 'yAxis' || dragType === 'zoomY') && (
          <div
            className="absolute top-0 z-[5] pointer-events-none transition-opacity duration-150"
            style={{
              right: 0,
              width: Y_AXIS_W,
              bottom: compact ? 0 : X_AXIS_H,
              background: 'linear-gradient(90deg, transparent 0%, rgba(127,127,127,0.10) 100%)',
              borderLeft: `1px dashed ${COLORS.border}`,
            }}
          >
            <div
              className="absolute right-1 top-1 px-1.5 py-0.5 rounded text-[0.55rem] uppercase tracking-[0.1em] font-bold"
              style={{
                background: COLORS.card,
                color: COLORS.heading,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              Drag ↕
            </div>
          </div>
        )}
        {!compact && (hoverRegion === 'xAxis' || dragType === 'zoomX') && (
          <div
            className="absolute left-0 z-[5] pointer-events-none transition-opacity duration-150"
            style={{
              right: Y_AXIS_W,
              bottom: 0,
              height: X_AXIS_H,
              background: 'linear-gradient(0deg, transparent 0%, rgba(127,127,127,0.10) 100%)',
              borderTop: `1px dashed ${COLORS.border}`,
            }}
          >
            <div
              className="absolute left-1 bottom-1 px-1.5 py-0.5 rounded text-[0.55rem] uppercase tracking-[0.1em] font-bold"
              style={{
                background: COLORS.card,
                color: COLORS.heading,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              Drag ↔
            </div>
          </div>
        )}

        <div className="absolute top-1 left-2 z-10 flex items-center gap-0.5 flex-wrap" data-no-pan>
          <button
            onClick={() => zoomBy(1 / 1.4)}
            className="w-6 h-6 flex items-center justify-center text-[0.85rem] font-bold rounded border"
            style={{ color: COLORS.muted, borderColor: COLORS.border, background: COLORS.card }}
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => zoomBy(1.4)}
            className="w-6 h-6 flex items-center justify-center text-[0.85rem] font-bold rounded border"
            style={{ color: COLORS.muted, borderColor: COLORS.border, background: COLORS.card }}
            title="Zoom out"
          >
            −
          </button>
          {isCustomView && (
            <button
              onClick={resetView}
              className="h-6 px-2 text-[0.62rem] font-semibold rounded border"
              style={{ color: COLORS.muted, borderColor: COLORS.border, background: COLORS.card }}
              title="Reset zoom (double-click)"
            >
              reset
            </button>
          )}
          {isCustomView && (
            <span
              className="h-6 px-2 inline-flex items-center text-[0.6rem] font-mono tabular-nums rounded border"
              style={{ color: COLORS.muted, borderColor: COLORS.border, background: COLORS.card }}
              title="Visible bars / total"
            >
              {visibleBars}/{rows.length}
            </span>
          )}

          <span className="w-px h-5 mx-0.5" style={{ background: COLORS.border }} />
          <ToolButton
            active={activeTool === 'trendline'}
            onClick={() => {
              setActiveTool(t => (t === 'trendline' ? 'none' : 'trendline'));
              setDrawAnchor(null);
            }}
            title="Trendline (2 click)"
          >
            ╱
          </ToolButton>
          <ToolButton
            active={activeTool === 'fib'}
            onClick={() => {
              setActiveTool(t => (t === 'fib' ? 'none' : 'fib'));
              setDrawAnchor(null);
            }}
            title="Fibonacci retracement (2 click)"
          >
            fib
          </ToolButton>
          <ToolButton
            active={activeTool === 'vertical'}
            onClick={() => {
              setActiveTool(t => (t === 'vertical' ? 'none' : 'vertical'));
              setDrawAnchor(null);
            }}
            title="Date annotation (1 click)"
          >
            │
          </ToolButton>
          {(activeTool !== 'none' || drawAnchor) && (
            <span
              className="h-6 px-2 inline-flex items-center text-[0.62rem] font-semibold rounded border"
              style={{
                color: '#26A69A',
                borderColor: '#26A69A55',
                background: 'rgba(38,166,154,0.10)',
              }}
            >
              {activeTool === 'trendline'
                ? drawAnchor
                  ? 'Click 2/2'
                  : 'Click 1/2'
                : activeTool === 'fib'
                  ? drawAnchor
                    ? 'Fib 2/2'
                    : 'Fib 1/2'
                  : activeTool === 'vertical'
                    ? 'Click data'
                    : ''}
              <button
                onClick={() => {
                  setActiveTool('none');
                  setDrawAnchor(null);
                }}
                className="ml-2 text-muted hover:text-negative"
                title="Cancel (Esc)"
                style={{ color: COLORS.muted }}
              >
                ✕
              </button>
            </span>
          )}
        </div>

        {selectRect && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: Math.min(selectRect.x1, selectRect.x2),
              width: Math.abs(selectRect.x2 - selectRect.x1),
              top: 0,
              bottom: compact ? 0 : X_AXIS_H,
              background: 'rgba(38,166,154,0.15)',
              border: '1px solid rgba(38,166,154,0.55)',
              borderRadius: 2,
            }}
          />
        )}
        <ResponsiveContainer width="100%" height={priceHeight}>
          <ComposedChart
            data={effectiveData}
            margin={{ top: 6, right: 50, left: 0, bottom: 0 }}
            syncId={`chart-${ticker}`}
            onMouseMove={handleHover}
            onMouseLeave={handleLeave}
          >
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: COLORS.tick }}
              tickLine={{ stroke: COLORS.axis }}
              axisLine={{ stroke: COLORS.axis }}
              minTickGap={50}
              tickFormatter={(d: string) => d.slice(0, 7)}
              hide={compact}
            />
            <YAxis
              yAxisId="price"
              orientation="right"
              tick={{ fontSize: 9, fill: COLORS.tick }}
              tickLine={{ stroke: COLORS.axis }}
              axisLine={{ stroke: COLORS.axis }}
              tickFormatter={(v: number) => fmtPx(v)}
              domain={yDomain ?? ['auto', 'auto']}
              allowDataOverflow={!!yDomain}
              scale={logScale ? 'log' : 'linear'}
              width={48}
            />
            {showVolume && (
              <YAxis
                yAxisId="volume"
                orientation="left"
                tick={false}
                tickLine={false}
                axisLine={false}
                domain={[0, 'dataMax']}
                width={0}
              />
            )}
            <Tooltip
              cursor={{ stroke: COLORS.muted, strokeDasharray: '3 4', strokeWidth: 1 }}
              content={() => null}
            />
            <ReferenceLine
              y={last?.close}
              yAxisId="price"
              stroke={dayChange >= 0 ? COLORS.up : COLORS.down}
              strokeDasharray="3 3"
              strokeWidth={1}
              label={
                last
                  ? {
                      position: 'right',
                      value: fmtPx(last.close),
                      fill: dayChange >= 0 ? COLORS.up : COLORS.down,
                      fontSize: 10,
                      offset: 4,
                    }
                  : undefined
              }
            />
            {srLevels.map((lv, i) => (
              <ReferenceLine
                key={`sr-${i}`}
                y={lv}
                yAxisId="price"
                stroke={lv > (last?.close ?? 0) ? 'rgba(239,83,80,0.45)' : 'rgba(38,166,154,0.45)'}
                strokeDasharray="2 4"
                strokeWidth={1}
              />
            ))}
            {(levels || []).map((lv, i) => (
              <ReferenceLine
                key={`lv-${i}`}
                y={lv}
                yAxisId="price"
                stroke="#FFB300"
                strokeWidth={1.4}
                strokeDasharray="6 4"
                label={{
                  position: 'right',
                  value: fmtPx(lv),
                  fill: '#FFB300',
                  fontSize: 9,
                  offset: 4,
                }}
              />
            ))}

            {showVolume && (
              <Bar
                dataKey="volume"
                yAxisId="volume"
                isAnimationActive={false}
                opacity={0.35}
              />
            )}

            {chartType === 'line' && (
              <Line
                type="monotone"
                yAxisId="price"
                dataKey="close"
                stroke={COLORS.sma20}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}
            {chartType === 'area' && (
              <Area
                type="monotone"
                yAxisId="price"
                dataKey="close"
                stroke={COLORS.sma20}
                strokeWidth={2}
                fill="rgba(66,165,245,0.18)"
                isAnimationActive={false}
              />
            )}
            {chartType === 'candlestick' && (
              <Customized component={CandleLayer as never} />
            )}
            {chartType === 'ohlc' && <Customized component={OHLCLayer as never} />}

            {indicators.includes('BB') && (
              <>
                <Line yAxisId="price" type="monotone" dataKey="BB_U" stroke={COLORS.bb} strokeOpacity={0.55} strokeWidth={1.1} dot={false} isAnimationActive={false} connectNulls />
                <Line yAxisId="price" type="monotone" dataKey="BB_M" stroke={COLORS.bb} strokeOpacity={0.45} strokeWidth={1.1} strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls />
                <Line yAxisId="price" type="monotone" dataKey="BB_L" stroke={COLORS.bb} strokeOpacity={0.55} strokeWidth={1.1} dot={false} isAnimationActive={false} connectNulls />
              </>
            )}
            {indicators.includes('SMA8') && (
              <Line yAxisId="price" type="monotone" dataKey="SMA8" stroke={COLORS.sma8} strokeWidth={1.2} dot={false} isAnimationActive={false} connectNulls />
            )}
            {indicators.includes('SMA20') && (
              <Line yAxisId="price" type="monotone" dataKey="SMA20" stroke={COLORS.sma20} strokeWidth={1.4} dot={false} isAnimationActive={false} connectNulls />
            )}
            {indicators.includes('SMA50') && (
              <Line yAxisId="price" type="monotone" dataKey="SMA50" stroke={COLORS.sma50} strokeWidth={1.4} dot={false} isAnimationActive={false} connectNulls />
            )}
            {indicators.includes('SMA200') && (
              <Line yAxisId="price" type="monotone" dataKey="SMA200" stroke={COLORS.sma200} strokeWidth={1.6} dot={false} isAnimationActive={false} connectNulls />
            )}
            {indicators.includes('EMA21') && (
              <Line yAxisId="price" type="monotone" dataKey="EMA21" stroke={COLORS.ema21} strokeWidth={1.4} dot={false} isAnimationActive={false} connectNulls />
            )}
            {indicators.includes('VWAP') && (
              <Line yAxisId="price" type="monotone" dataKey="VWAP" stroke={COLORS.vwap} strokeWidth={1.3} strokeDasharray="2 3" dot={false} isAnimationActive={false} connectNulls />
            )}

            {overlayTicker && overlayMap && overlayAnchor && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="overlay"
                stroke={COLORS.vwap}
                strokeWidth={1.6}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            )}

            {drawings && drawings.length > 0 && (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <Customized component={(p: any) => <DrawingLayer {...p} drawings={drawings} />} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {wantRSI && (
        <div className="px-1">
          <ResponsiveContainer width="100%" height={subHeight}>
            <ComposedChart data={effectiveData} margin={{ top: 0, right: 50, left: 0, bottom: 0 }} syncId={`chart-${ticker}`}>
              <XAxis dataKey="date" tick={false} tickLine={false} axisLine={{ stroke: COLORS.axis }} hide />
              <YAxis orientation="right" tick={{ fontSize: 9, fill: COLORS.tick }} tickLine={{ stroke: COLORS.axis }} axisLine={{ stroke: COLORS.axis }} domain={[0, 100]} ticks={[30, 50, 70]} width={48} />
              <ReferenceArea y1={30} y2={70} fill="rgba(142,92,247,0.06)" stroke="" />
              <ReferenceLine y={70} stroke={COLORS.muted} strokeDasharray="2 3" />
              <ReferenceLine y={30} stroke={COLORS.muted} strokeDasharray="2 3" />
              <Line type="monotone" dataKey="RSI" stroke={COLORS.rsi} strokeWidth={1.4} dot={false} isAnimationActive={false} connectNulls />
              <Tooltip cursor={{ stroke: COLORS.muted, strokeDasharray: '3 4' }} content={() => null} />
              <SubPanelLabel label="RSI 14" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {wantMACD && (
        <div className="px-1">
          <ResponsiveContainer width="100%" height={subHeight}>
            <ComposedChart data={effectiveData} margin={{ top: 0, right: 50, left: 0, bottom: 0 }} syncId={`chart-${ticker}`}>
              <XAxis dataKey="date" tick={false} tickLine={false} axisLine={{ stroke: COLORS.axis }} hide />
              <YAxis orientation="right" tick={{ fontSize: 9, fill: COLORS.tick }} tickLine={{ stroke: COLORS.axis }} axisLine={{ stroke: COLORS.axis }} width={48} />
              <ReferenceLine y={0} stroke={COLORS.muted} strokeOpacity={0.4} />
              <Bar dataKey="MACD_H" isAnimationActive={false} fill={COLORS.macdLine} fillOpacity={0.5} />
              <Line type="monotone" dataKey="MACD_L" stroke={COLORS.macdLine} strokeWidth={1.4} dot={false} isAnimationActive={false} connectNulls />
              <Line type="monotone" dataKey="MACD_S" stroke={COLORS.macdSignal} strokeWidth={1.4} dot={false} isAnimationActive={false} connectNulls />
              <Tooltip cursor={{ stroke: COLORS.muted, strokeDasharray: '3 4' }} content={() => null} />
              <SubPanelLabel label="MACD 12·26·9" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {wantATR && (
        <div className="px-1">
          <ResponsiveContainer width="100%" height={subHeight}>
            <ComposedChart data={effectiveData} margin={{ top: 0, right: 50, left: 0, bottom: 0 }} syncId={`chart-${ticker}`}>
              <XAxis dataKey="date" tick={false} tickLine={false} axisLine={{ stroke: COLORS.axis }} hide />
              <YAxis orientation="right" tick={{ fontSize: 9, fill: COLORS.tick }} tickLine={{ stroke: COLORS.axis }} axisLine={{ stroke: COLORS.axis }} width={48} />
              <Area type="monotone" dataKey="ATR" stroke={COLORS.atr} strokeWidth={1.4} fill="rgba(255,183,77,0.18)" isAnimationActive={false} connectNulls />
              <Tooltip cursor={{ stroke: COLORS.muted, strokeDasharray: '3 4' }} content={() => null} />
              <SubPanelLabel label="ATR 14" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {wantOBV && (
        <div className="px-1">
          <ResponsiveContainer width="100%" height={subHeight}>
            <ComposedChart data={effectiveData} margin={{ top: 0, right: 50, left: 0, bottom: 18 }} syncId={`chart-${ticker}`}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: COLORS.tick }} tickLine={{ stroke: COLORS.axis }} axisLine={{ stroke: COLORS.axis }} minTickGap={50} tickFormatter={(d: string) => d.slice(0, 7)} />
              <YAxis orientation="right" tick={{ fontSize: 9, fill: COLORS.tick }} tickLine={{ stroke: COLORS.axis }} axisLine={{ stroke: COLORS.axis }} width={48} tickFormatter={fmtVol} />
              <Line type="monotone" dataKey="OBV" stroke={COLORS.obv} strokeWidth={1.4} dot={false} isAnimationActive={false} connectNulls />
              <Tooltip cursor={{ stroke: COLORS.muted, strokeDasharray: '3 4' }} content={() => null} />
              <SubPanelLabel label="OBV" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {onRangeChange && (
        <div
          className="flex items-center gap-1 flex-wrap px-2 py-1.5 border-t"
          style={{ borderColor: COLORS.border, background: COLORS.card }}
        >
          <span className="text-[0.6rem] uppercase tracking-[0.12em] text-muted font-semibold mr-1">
            Range
          </span>
          {RANGE_PRESETS.map(p => {
            const isOn = rangeDays === p.days;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onRangeChange(p.days)}
                className="text-[0.66rem] font-bold px-2 py-0.5 rounded border transition-colors tabular-nums"
                style={{
                  color: isOn ? COLORS.card : COLORS.muted,
                  background: isOn ? COLORS.heading : 'transparent',
                  borderColor: isOn ? COLORS.heading : COLORS.border,
                }}
                title={`Show the last ${p.label}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="h-6 min-w-6 px-1.5 inline-flex items-center justify-center text-[0.7rem] font-bold rounded border transition"
      style={{
        color: active ? COLORS.heading : COLORS.muted,
        borderColor: active ? COLORS.heading : COLORS.border,
        background: active ? 'rgba(127,127,127,0.10)' : COLORS.card,
      }}
      title={title}
    >
      {children}
    </button>
  );
}

interface DrawingLayerProps {
  drawings: ChartDrawing[] | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

function DrawingLayer(props: DrawingLayerProps) {
  const { drawings, xAxisMap, yAxisMap, offset } = props;
  if (!drawings || drawings.length === 0) return null;
  if (!xAxisMap || !yAxisMap || !offset) return null;
  const xKey = Object.keys(xAxisMap)[0];
  const yKey = Object.keys(yAxisMap).find((k) => yAxisMap[k]?.orientation === 'right')
    || Object.keys(yAxisMap)[0];
  const xAxis = xAxisMap[xKey];
  const yAxis = yAxisMap[yKey];
  if (!xAxis?.scale || !yAxis?.scale) return null;
  const top = offset.top ?? 0;
  const bottom = top + (offset.height ?? 0);

  return (
    <g pointerEvents="none">
      {drawings.map((d) => {
        const color = d.color || '#26A69A';
        if (d.type === 'trendline') {
          const x1 = xAxis.scale(d.from.date);
          const x2 = xAxis.scale(d.to.date);
          const y1 = yAxis.scale(d.from.price);
          const y2 = yAxis.scale(d.to.price);
          if (![x1, x2, y1, y2].every((v) => Number.isFinite(v))) return null;
          return (
            <g key={d.id}>
              <line x1={x1} x2={x2} y1={y1} y2={y2} stroke={color} strokeWidth={1.6} />
              <circle cx={x1} cy={y1} r={2.5} fill={color} />
              <circle cx={x2} cy={y2} r={2.5} fill={color} />
            </g>
          );
        }
        if (d.type === 'fib') {
          const x1 = xAxis.scale(d.from.date);
          const x2 = xAxis.scale(d.to.date);
          if (!Number.isFinite(x1) || !Number.isFinite(x2)) return null;
          const lhs = Math.min(x1, x2);
          const rhs = Math.max(x1, x2);
          const hi = Math.max(d.from.price, d.to.price);
          const lo = Math.min(d.from.price, d.to.price);
          const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
          return (
            <g key={d.id}>
              {levels.map((lvl, i) => {
                const price = hi - lvl * (hi - lo);
                const y = yAxis.scale(price);
                if (!Number.isFinite(y)) return null;
                return (
                  <g key={i}>
                    <line
                      x1={lhs}
                      x2={rhs}
                      y1={y}
                      y2={y}
                      stroke={color}
                      strokeOpacity={0.65}
                      strokeWidth={1}
                      strokeDasharray={lvl === 0 || lvl === 1 ? undefined : '4 3'}
                    />
                    <text x={rhs + 4} y={y + 3} fill={color} fontSize={9} fontFamily="monospace">
                      {(lvl * 100).toFixed(1)}% {fmtPx(price)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        }
        if (d.type === 'vertical') {
          const x = xAxis.scale(d.date);
          if (!Number.isFinite(x)) return null;
          return (
            <g key={d.id}>
              <line
                x1={x}
                x2={x}
                y1={top}
                y2={bottom}
                stroke={color}
                strokeWidth={1.2}
                strokeDasharray="3 3"
              />
              <text x={x + 4} y={top + 10} fill={color} fontSize={9} fontFamily="monospace">
                {d.label || d.date}
              </text>
            </g>
          );
        }
        return null;
      })}
    </g>
  );
}

function SubPanelLabel({ label }: { label: string }) {
  return (
    <Customized
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component={(p: any) => {
        return (
          <text
            x={(p?.offset?.left ?? 6) + 4}
            y={12}
            fill={COLORS.muted}
            fontSize={9}
            fontFamily="monospace"
            textAnchor="start"
          >
            {label}
          </text>
        );
      }}
    />
  );
}
