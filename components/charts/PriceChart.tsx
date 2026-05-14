/**
 * Inline SVG price chart with optional SMA/EMA overlays. Pure server-component
 * — no client JS, no chart libraries. Designed to match the terminal look.
 */
type Overlay = { values: Array<number | null>; color: string; label: string };

type Props = {
  closes: number[];
  timestamps: number[];
  overlays?: Overlay[];
  height?: number;
};

export function PriceChart({ closes, timestamps, overlays = [], height = 280 }: Props) {
  if (closes.length < 2) {
    return <div className="text-sm text-zinc-500">No data.</div>;
  }
  const W = 1000;
  const padL = 40;
  const padR = 8;
  const padT = 8;
  const padB = 24;
  const innerW = W - padL - padR;
  const innerH = height - padT - padB;

  const allVals: number[] = [...closes];
  overlays.forEach((o) => o.values.forEach((v) => v != null && allVals.push(v)));
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const span = max - min || 1;

  const stepX = innerW / (closes.length - 1);
  const xOf = (i: number) => padL + i * stepX;
  const yOf = (v: number) => padT + innerH - ((v - min) / span) * innerH;

  const priceLine = closes
    .map((v, i) => `${xOf(i).toFixed(2)},${yOf(v).toFixed(2)}`)
    .join(" ");

  // Y-axis labels (4 ticks)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = min + f * span;
    return { y: padT + innerH - f * innerH, label: v };
  });

  // X-axis labels: first, middle, last timestamp
  const tsFmt = (t: number) => {
    const d = new Date(t * 1000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  };
  const xTicks = [0, Math.floor(closes.length / 2), closes.length - 1].map((i) => ({
    x: xOf(i),
    label: tsFmt(timestamps[i] ?? 0),
  }));

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
    >
      {/* grid */}
      {yTicks.map((t, i) => (
        <line
          key={i}
          x1={padL}
          x2={W - padR}
          y1={t.y}
          y2={t.y}
          stroke="#1f1f23"
          strokeDasharray="2,3"
        />
      ))}
      {/* axes labels */}
      {yTicks.map((t, i) => (
        <text
          key={`yl-${i}`}
          x={padL - 4}
          y={t.y + 3}
          fontSize={9}
          fill="#7a7a82"
          textAnchor="end"
        >
          {t.label.toFixed(t.label > 100 ? 0 : 2)}
        </text>
      ))}
      {xTicks.map((t, i) => (
        <text
          key={`xl-${i}`}
          x={t.x}
          y={height - 6}
          fontSize={9}
          fill="#7a7a82"
          textAnchor="middle"
        >
          {t.label}
        </text>
      ))}
      {/* overlays first (under) */}
      {overlays.map((o, idx) => {
        const pts: string[] = [];
        o.values.forEach((v, i) => {
          if (v != null && Number.isFinite(v)) pts.push(`${xOf(i).toFixed(2)},${yOf(v).toFixed(2)}`);
        });
        return pts.length > 1 ? (
          <polyline
            key={idx}
            fill="none"
            stroke={o.color}
            strokeWidth={1}
            opacity={0.7}
            points={pts.join(" ")}
          />
        ) : null;
      })}
      {/* price line on top */}
      <polyline
        fill="none"
        stroke="#d4af37"
        strokeWidth={1.5}
        points={priceLine}
      />
    </svg>
  );
}
