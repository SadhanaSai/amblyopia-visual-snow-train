import { useEffect, useMemo } from 'react';
import type { StereoResult } from '../types/assessment';
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
const LOG_BEST = Math.log10(20); // best plausible threshold, plots at top
const LOG_WORST = Math.log10(1000);

const CLINICAL_LINES = [
  { arcsec: 800, label: 'gross (800)' },
  { arcsec: 200, label: 'functional (200)' },
  { arcsec: 60, label: 'good (60)' },
  { arcsec: 40, label: 'normal (40)' },
];

interface StereoChartProps {
  results: StereoResult[];
}

export default function StereoChart({ results }: StereoChartProps) {
  const m = DEFAULT_MARGIN;
  const { containerRef, canvasRef, width } = useResponsiveChartCanvas(HEIGHT);
  const yFor = (logValue: number) => scaleLinear(logValue, [LOG_BEST, LOG_WORST], [m.top, HEIGHT - m.bottom]);
  const [domainStart, domainEnd] = useMemo(() => dateDomain(results.map((r) => r.date)), [results]);
  const xFor = (iso: string) =>
    scaleLinear(new Date(iso).getTime(), [domainStart, domainEnd], [m.left + 8, width - m.right - 8]);

  const tooltipPoints = useMemo<TooltipPoint[]>(
    () =>
      results.map((r) => ({
        x: xFor(r.date),
        y: yFor(r.logThreshold),
        label: formatShortDate(r.date),
        value: r.noMeasurableStereopsis ? `>${r.thresholdArcsec} arcsec (not measurable)` : `${r.thresholdArcsec} arcsec`,
      })),
    [results, domainStart, domainEnd, width],
  );
  const { hover, handleMouseMove, handleMouseLeave } = useChartTooltip(canvasRef, tooltipPoints, width);

  useEffect(() => {
    if (results.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, width, HEIGHT);
    drawAxes(ctx, width, HEIGHT, m);

    for (const line of CLINICAL_LINES) {
      drawHLine(ctx, yFor(Math.log10(line.arcsec)), m.left, width - m.right, '#D1D5DB', line.label);
    }

    const points = results.map((r) => ({ x: xFor(r.date), y: yFor(r.logThreshold) }));
    drawLine(ctx, points, '#2563EB');

    drawDateTicks(ctx, [domainStart, domainEnd], [m.left + 8, width - m.right - 8], HEIGHT - m.bottom + 14);
  }, [results, domainStart, domainEnd, width]);

  if (results.length === 0) {
    return (
      <ChartCard title="Stereoacuity">
        <p className="text-xs text-gray-400">Run the Stereo Test (requires anaglyph glasses) to see this chart.</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Stereoacuity" footer={<span>Lower arc-seconds = better</span>}>
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
