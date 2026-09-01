import { useEffect, useRef } from 'react';
import type { SuppressionResult } from '../types/assessment';
import { DEFAULT_MARGIN, drawAxes, drawLine, drawShadedArea, formatShortDate, scaleLinear } from './chartUtils';

const WIDTH = 640;
const HEIGHT = 200;

interface SuppressionChartProps {
  results: SuppressionResult[];
}

export default function SuppressionChart({ results }: SuppressionChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const m = DEFAULT_MARGIN;
    drawAxes(ctx, WIDTH, HEIGHT, m);

    const maxVal = Math.max(10, ...results.map((r) => r.thresholdContrastPct));
    // Inverted: lower contrast threshold (less suppression) plots higher on the chart.
    const yFor = (v: number) => scaleLinear(v, [0, maxVal], [m.top, HEIGHT - m.bottom]);
    const xFor = (i: number, n: number) =>
      scaleLinear(i, [0, Math.max(1, n - 1)], [m.left + 8, WIDTH - m.right - 8]);

    const points = results.map((r, i) => ({ x: xFor(i, results.length), y: yFor(r.thresholdContrastPct) }));
    drawShadedArea(ctx, points, HEIGHT - m.bottom, 'rgba(37, 99, 235, 0.08)');
    drawLine(ctx, points, '#2563EB');

    if (results.length > 0) {
      ctx.fillStyle = '#6B7280';
      ctx.font = '10px system-ui';
      ctx.fillText(formatShortDate(results[0].date), m.left, HEIGHT - m.bottom + 14);
      ctx.fillText(
        formatShortDate(results[results.length - 1].date),
        WIDTH - m.right - 30,
        HEIGHT - m.bottom + 14,
      );
    }
  }, [results]);

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-700">Suppression Depth</h3>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full rounded border border-gray-100" />
      <div className="mt-1 text-xs text-gray-400">Lower = less suppression (better)</div>
    </div>
  );
}
