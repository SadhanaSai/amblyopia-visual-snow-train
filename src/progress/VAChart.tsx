import { useEffect, useMemo } from 'react';
import type { VAResult } from '../types/assessment';
import { MILESTONES } from '../data/milestones';
import ChartCard from './ChartCard';
import ChartTooltip from './ChartTooltip';
import {
  DEFAULT_MARGIN,
  dateDomain,
  drawAxes,
  drawDateTicks,
  drawHLine,
  drawLine,
  formatShortDate,
  scaleLinear,
} from './chartUtils';
import { useChartTooltip, type TooltipPoint } from './useChartTooltip';
import { useResponsiveChartCanvas } from './useResponsiveChartCanvas';

const HEIGHT = 240;
const LOGMAR_BEST = -0.1;
const LOGMAR_WORST = 1.0;

interface VAChartProps {
  results: VAResult[];
}

export default function VAChart({ results }: VAChartProps) {
  const m = DEFAULT_MARGIN;
  const { containerRef, canvasRef, width } = useResponsiveChartCanvas(HEIGHT);
  const yFor = (logMAR: number) => scaleLinear(logMAR, [LOGMAR_BEST, LOGMAR_WORST], [m.top, HEIGHT - m.bottom]);

  const [domainStart, domainEnd] = useMemo(() => dateDomain(results.map((r) => r.date)), [results]);
  const xFor = (iso: string) =>
    scaleLinear(new Date(iso).getTime(), [domainStart, domainEnd], [m.left + 8, width - m.right - 8]);

  const tooltipPoints = useMemo<TooltipPoint[]>(
    () =>
      results.map((r) => ({
        x: xFor(r.date),
        y: yFor(r.logMAR),
        label: `${formatShortDate(r.date)} · ${r.eye} eye`,
        value: `${r.logMAR.toFixed(2)} logMAR`,
      })),
    [results, domainStart, domainEnd, width],
  );
  const { hover, handleMouseMove, handleMouseLeave } = useChartTooltip(canvasRef, tooltipPoints, width);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, width, HEIGHT);
    drawAxes(ctx, width, HEIGHT, m);

    drawHLine(ctx, yFor(0.1), m.left, width - m.right, '#F59E0B', 'near normal (0.1)');
    drawHLine(ctx, yFor(0.3), m.left, width - m.right, '#F97316', 'moderate (0.3)');

    const weak = results.filter((r) => r.eye === 'weak');
    const strong = results.filter((r) => r.eye === 'strong');

    drawLine(
      ctx,
      weak.map((r) => ({ x: xFor(r.date), y: yFor(r.logMAR) })),
      '#2563EB',
    );
    drawLine(
      ctx,
      strong.map((r) => ({ x: xFor(r.date), y: yFor(r.logMAR) })),
      '#93C5FD',
      true,
    );

    if (weak.length > 0) {
      const first = weak[0].logMAR;
      for (const milestone of MILESTONES) {
        if (milestone.metric !== 'logMAR_improvement' && milestone.metric !== 'logMAR_absolute') continue;
        const achieving = weak.find((r) =>
          milestone.metric === 'logMAR_improvement'
            ? first - r.logMAR >= milestone.threshold
            : r.logMAR <= milestone.threshold,
        );
        if (!achieving) continue;
        const x = xFor(achieving.date);
        ctx.strokeStyle = '#10B981';
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(x, m.top);
        ctx.lineTo(x, HEIGHT - m.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (results.length > 0) {
      drawDateTicks(ctx, [domainStart, domainEnd], [m.left + 8, width - m.right - 8], HEIGHT - m.bottom + 14);
    }
  }, [results, domainStart, domainEnd, width]);

  return (
    <ChartCard
      title="Visual Acuity"
      footer={
        <>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-blue-600" /> weak eye
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-blue-300" /> strong eye
          </span>
          <span>1 line = 0.1 logMAR</span>
        </>
      }
    >
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
