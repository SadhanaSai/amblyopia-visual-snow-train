import { useEffect, useMemo } from 'react';
import type { CSFResult } from '../types/assessment';
import ChartCard from './ChartCard';
import ChartTooltip from './ChartTooltip';
import {
  DEFAULT_MARGIN,
  dateDomain,
  dayKey,
  drawAxes,
  drawDateTicks,
  drawGapArea,
  drawLine,
  drawYGrid,
  formatShortDate,
  scaleLinear,
} from './chartUtils';
import { useChartTooltip, type TooltipPoint } from './useChartTooltip';
import { useResponsiveChartCanvas } from './useResponsiveChartCanvas';

const HEIGHT = 240;

interface CSFChartProps {
  results: CSFResult[];
}

export default function CSFChart({ results }: CSFChartProps) {
  const m = DEFAULT_MARGIN;
  const { containerRef, canvasRef, width } = useResponsiveChartCanvas(HEIGHT);
  const maxVal = Math.max(1, ...results.map((r) => r.AULCSF));
  const yFor = (v: number) => scaleLinear(v, [0, maxVal], [HEIGHT - m.bottom, m.top]);
  const [domainStart, domainEnd] = useMemo(() => dateDomain(results.map((r) => r.date)), [results]);
  const xFor = (iso: string) =>
    scaleLinear(new Date(iso).getTime(), [domainStart, domainEnd], [m.left + 8, width - m.right - 8]);

  const tooltipPoints = useMemo<TooltipPoint[]>(
    () =>
      results.map((r) => ({
        x: xFor(r.date),
        y: yFor(r.AULCSF),
        label: `${formatShortDate(r.date)} · ${r.eye} eye`,
        value: `AULCSF ${r.AULCSF.toFixed(2)}`,
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
      { y: yFor(0), label: '0' },
      { y: yFor(maxVal / 2), label: (maxVal / 2).toFixed(1) },
      { y: yFor(maxVal), label: maxVal.toFixed(1) },
    ]);
    drawAxes(ctx, width, HEIGHT, m);

    const weak = results.filter((r) => r.eye === 'weak');
    const strong = results.filter((r) => r.eye === 'strong');

    const weakPoints = weak.map((r) => ({ x: xFor(r.date), y: yFor(r.AULCSF) }));
    const strongPoints = strong.map((r) => ({ x: xFor(r.date), y: yFor(r.AULCSF) }));

    // Only shade the interocular gap where both eyes have a reading on the same
    // calendar day — with real date spacing, weak/strong runs need not align 1:1.
    const strongByDay = new Map(strong.map((r) => [dayKey(new Date(r.date)), r]));
    const sharedDayWeak = weak.filter((r) => strongByDay.has(dayKey(new Date(r.date))));
    if (sharedDayWeak.length > 0) {
      const gapUpper = sharedDayWeak.map((r) => ({ x: xFor(r.date), y: yFor(r.AULCSF) }));
      const gapLower = sharedDayWeak.map((r) => {
        const match = strongByDay.get(dayKey(new Date(r.date)))!;
        return { x: xFor(r.date), y: yFor(match.AULCSF) };
      });
      drawGapArea(ctx, gapUpper, gapLower, 'rgba(37, 99, 235, 0.08)');
    }
    drawLine(ctx, weakPoints, '#2563EB');
    drawLine(ctx, strongPoints, '#93C5FD', true);

    if (results.length > 0) {
      drawDateTicks(ctx, [domainStart, domainEnd], [m.left + 8, width - m.right - 8], HEIGHT - m.bottom + 14);
    }
  }, [results, domainStart, domainEnd, maxVal, width]);

  return (
    <ChartCard
      title="Contrast Sensitivity (AULCSF)"
      footer={
        <>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-blue-600" /> weak eye
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-blue-300" /> strong eye
          </span>
          <span>shaded = interocular difference</span>
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
