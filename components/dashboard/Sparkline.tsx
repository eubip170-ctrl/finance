/**
 * Minimal SVG sparkline — no external chart deps.
 * Renders the normalized series; positive vs negative net move drives colour.
 */
type Props = {
  values: number[];
  width?: number;
  height?: number;
  positive?: boolean;
};

export function Sparkline({ values, width = 120, height = 32, positive }: Props) {
  if (values.length < 2) {
    return <div className="h-8 w-full text-xs text-zinc-600">no data</div>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * stepX).toFixed(2)},${(height - ((v - min) / span) * height).toFixed(2)}`)
    .join(" ");
  const up = positive ?? values[values.length - 1] >= values[0];
  const stroke = up ? "#34d399" : "#f87171";
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline fill="none" stroke={stroke} strokeWidth={1.4} points={points} />
    </svg>
  );
}
