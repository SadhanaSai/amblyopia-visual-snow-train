import { useEffect, useMemo } from 'react';
import type { SuppressionResult } from '../types/assessment';
import ChartCard from './ChartCard';
import ChartTooltip from './ChartTooltip';
import {
  DEFAULT_MARGIN,
  dateDomain,
  drawAxes,
  drawDateTicks,
  drawLine,
  drawShadedArea,
  drawYGrid,
  formatShortDate,
  scaleLinear,
} from './chartUtils';
import { useChartTooltip, type TooltipPoint } from './useChartTooltip';
import { useResponsiveChartCanvas } from './useResponsiveChartCanvas';

const HEIGHT = 200;

interface SuppressionChartProps {
  results: SuppressionResult[];
}

export default function SuppressionChart({ results }: SuppressionChartProps) {
  const m = DEFAULT_MARGIN;
  const { containerRef, canvasRef, width } = useResponsiveChartCanvas(HEIGHT);
  const maxVal = Math.max(10, ...results.map((r) => r.thresholdContrastPct));
  const yFor = (v: number) => scaleLinear(v, [0, maxVal], [m.top, HEIGHT - m.bottom]);
  const [domainStart, domainEnd] = useMemo(() => dateDomain(results.map((r) => r.date)), [results]);
  const xFor = (iso: string) =>
    scaleLinear(new Date(iso).getTime(), [domainStart, domainEnd], [m.left + 8, width - m.right - 8]);

  const tooltipPoints = useMemo<TooltipPoint[]>(
    () =>
      results.map((r) => ({
        x: xFor(r.date),
        y: yFor(r.thresholdContrastPct),
        label: formatShortDate(r.date),
        value: `${r.thresholdContrastPct.toFixed(1)}%`,
      })),
    [results, domainStart, domainEnd, maxVal, width],
  );
  const { hover, handleMouseMove, handleMouseLeave } = useChartTooltip(canvasRef, tooltipPoints, width);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, width, HEIGHT);

    drawYGrid(ctx, m, width, [
      { y: yFor(0), label: '0%' },
      { y: yFor(maxVal / 2), label: `${(maxVal / 2).toFixed(0)}%` },
      { y: yFor(maxVal), label: `${maxVal.toFixed(0)}%` },
    ]);
    drawAxes(ctx, width, HEIGHT, m);

    const points = results.map((r) => ({ x: xFor(r.date), y: yFor(r.thresholdContrastPct) }));
    drawShadedArea(ctx, points, HEIGHT - m.bottom, 'rgba(37, 99, 235, 0.08)');
    drawLine(ctx, points, '#2563EB');

    if (results.length > 0) {
      drawDateTicks(ctx, [domainStart, domainEnd], [m.left + 8, width - m.right - 8], HEIGHT - m.bottom + 14);
    }
  }, [results, domainStart, domainEnd, maxVal, width]);

  return (
    <ChartCard title="Suppression Depth" footer={<span>Lower = less suppression (better)</span>}>
      <div ref={containerRef} className="relative">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="block cursor-crosshair rounded border border-gray-100"
        />
        <ChartTooltip hover={hover} width={width} height={HEIGHT} />
      </div>
    </ChartCard>
  );
}
