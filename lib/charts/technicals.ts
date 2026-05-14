/*
 * Technical indicators — TypeScript port of the helpers used by the
 * medge2 charts engine. All take aligned numeric series and return
 * same-length arrays with NaN where the indicator is undefined (so the
 * chart can simply skip those points via connectNulls).
 */

export interface OHLCVRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const NaNArr = (n: number) => new Array<number>(n).fill(NaN);

/** Simple Moving Average. */
export function sma(values: number[], n: number): number[] {
  const out = NaNArr(values.length);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    if (isFinite(values[i])) {
      sum += values[i];
      count++;
    }
    if (i >= n) {
      const drop = values[i - n];
      if (isFinite(drop)) {
        sum -= drop;
        count--;
      }
    }
    if (i >= n - 1 && count > 0) out[i] = sum / count;
  }
  return out;
}

/** Exponential Moving Average. */
export function ema(values: number[], n: number): number[] {
  const out = NaNArr(values.length);
  if (values.length === 0) return out;
  const k = 2 / (n + 1);
  let prev = NaN;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!isFinite(v)) {
      out[i] = prev;
      continue;
    }
    if (!isFinite(prev)) {
      prev = v;
    } else {
      prev = v * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  for (let i = 0; i < Math.min(n - 1, out.length); i++) out[i] = NaN;
  return out;
}

/** RSI (Wilder) — n-period. */
export function rsi(values: number[], n = 14): number[] {
  const out = NaNArr(values.length);
  if (values.length <= n) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= n;
  loss /= n;
  out[n] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = n + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    gain = (gain * (n - 1) + g) / n;
    loss = (loss * (n - 1) + l) / n;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

/** Bollinger Bands. */
export function bbands(
  values: number[],
  n = 20,
  k = 2,
): { upper: number[]; mid: number[]; lower: number[] } {
  const mid = sma(values, n);
  const upper = NaNArr(values.length);
  const lower = NaNArr(values.length);
  for (let i = n - 1; i < values.length; i++) {
    let s = 0;
    let count = 0;
    for (let j = i - n + 1; j <= i; j++) {
      const v = values[j];
      if (isFinite(v) && isFinite(mid[i])) {
        s += (v - mid[i]) ** 2;
        count++;
      }
    }
    if (count > 1) {
      const sd = Math.sqrt(s / count);
      upper[i] = mid[i] + k * sd;
      lower[i] = mid[i] - k * sd;
    }
  }
  return { upper, mid, lower };
}

/** MACD. fast=12, slow=26, signal=9. Returns line / signal / histogram. */
export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): { line: number[]; signal: number[]; hist: number[] } {
  const ef = ema(values, fast);
  const es = ema(values, slow);
  const line = values.map((_, i) =>
    isFinite(ef[i]) && isFinite(es[i]) ? ef[i] - es[i] : NaN,
  );
  const sig = ema(line.map((v) => (isFinite(v) ? v : 0)), signal);
  const hist = line.map((v, i) =>
    isFinite(v) && isFinite(sig[i]) ? v - sig[i] : NaN,
  );
  return { line, signal: sig, hist };
}

/** Average True Range (Wilder). */
export function atr(rows: OHLCVRow[], n = 14): number[] {
  const out = NaNArr(rows.length);
  if (rows.length === 0) return out;
  const tr: number[] = [0];
  for (let i = 1; i < rows.length; i++) {
    const h = rows[i].high;
    const l = rows[i].low;
    const pc = rows[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  let sum = 0;
  for (let i = 1; i <= n && i < tr.length; i++) sum += tr[i];
  if (tr.length > n) {
    out[n] = sum / n;
    for (let i = n + 1; i < tr.length; i++) {
      out[i] = (out[i - 1] * (n - 1) + tr[i]) / n;
    }
  }
  return out;
}

/** On-Balance Volume cumulative. */
export function obv(rows: OHLCVRow[]): number[] {
  const out = new Array<number>(rows.length).fill(0);
  for (let i = 1; i < rows.length; i++) {
    const dC = rows[i].close - rows[i - 1].close;
    const sign = dC > 0 ? 1 : dC < 0 ? -1 : 0;
    out[i] = out[i - 1] + sign * (rows[i].volume || 0);
  }
  return out;
}

/** Volume-weighted average price (cumulative from window start). */
export function vwap(rows: OHLCVRow[]): number[] {
  const out = NaNArr(rows.length);
  let cumPv = 0;
  let cumV = 0;
  for (let i = 0; i < rows.length; i++) {
    const tp = (rows[i].high + rows[i].low + rows[i].close) / 3;
    const v = rows[i].volume || 0;
    cumPv += tp * v;
    cumV += v;
    out[i] = cumV > 0 ? cumPv / cumV : NaN;
  }
  return out;
}

/** Detect support/resistance levels by clustering local extrema. */
export function detectSRLevels(values: number[], window = 8, maxLevels = 6): number[] {
  const finite = values.filter((v) => isFinite(v));
  if (finite.length < window * 3) return [];
  const extrema: number[] = [];
  for (let i = window; i < values.length - window; i++) {
    const v = values[i];
    if (!isFinite(v)) continue;
    let isHigh = true;
    let isLow = true;
    for (let k = 1; k <= window; k++) {
      const a = values[i - k];
      const b = values[i + k];
      if (!(a < v) || !(b < v)) isHigh = false;
      if (!(a > v) || !(b > v)) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh || isLow) extrema.push(v);
  }
  if (extrema.length === 0) return [];
  extrema.sort((a, b) => a - b);
  const clusters: number[] = [];
  let group: number[] = [extrema[0]];
  for (let i = 1; i < extrema.length; i++) {
    const last = group[group.length - 1];
    if ((extrema[i] - last) / Math.max(last, 1e-9) < 0.005) {
      group.push(extrema[i]);
    } else {
      clusters.push(group.reduce((s, v) => s + v, 0) / group.length);
      group = [extrema[i]];
    }
  }
  clusters.push(group.reduce((s, v) => s + v, 0) / group.length);
  const last = values[values.length - 1];
  return clusters
    .sort((a, b) => Math.abs(a - last) - Math.abs(b - last))
    .slice(0, maxLevels);
}

/** Helpers to extract aligned numeric arrays from OHLCV rows. */
export function pluck(rows: OHLCVRow[], key: keyof OHLCVRow): number[] {
  return rows.map((r) => Number(r[key]));
}
