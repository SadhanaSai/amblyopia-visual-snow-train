import type { TooltipPoint } from './useChartTooltip';

interface ChartTooltipProps {
  hover: TooltipPoint | null;
  width: number;
  height: number;
}

/** Small floating bubble positioned over the nearest hovered chart point.
 * Percentage-based so it stays aligned regardless of canvas CSS scaling. */
export default function ChartTooltip({ hover, width, height }: ChartTooltipProps) {
  if (!hover) return null;
  const leftPct = (hover.x / width) * 100;
  const topPct = (hover.y / height) * 100;
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-gray-900 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg"
      style={{ left: `${leftPct}%`, top: `${topPct}%`, marginTop: -8 }}
    >
      <div className="font-medium">{hover.label}</div>
      <div className="text-gray-300">{hover.value}</div>
    </div>
  );
}
