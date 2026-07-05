/**
 * Tiny inline sparkline chart — no library needed.
 * Renders a 50×16px SVG polyline from an array of prices.
 * Line is green if the last price is the lowest, red if highest, gray otherwise.
 */
export function Sparkline({ prices, width = 50, height = 16 }: { prices: number[]; width?: number; height?: number }) {
  if (!prices || prices.length < 2) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width;
    const y = height - ((p - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const lastPrice = prices[prices.length - 1];
  const isLowest = lastPrice === min;
  const isHighest = lastPrice === max;
  const color = isLowest ? "#22c55e" : isHighest ? "#ef4444" : "#71717a";

  return (
    <svg width={width} height={height} className="inline-block shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {isLowest && <circle cx={width} cy={height - ((lastPrice - min) / range) * height} r="2" fill="#22c55e" />}
    </svg>
  );
}
