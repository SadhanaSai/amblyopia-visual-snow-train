import { useEffect, useRef } from 'react';
import type { CSFResult } from '../types/assessment';
import { DEFAULT_MARGIN, drawAxes, drawGapArea, drawLine, formatShortDate, scaleLinear } from './chartUtils';

const WIDTH = 640;
const HEIGHT = 240;

interface CSFChartProps {
  results: CSFResult[];
}

export default function CSFChart({ results }: CSFChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const m = DEFAULT_MARGIN;
    drawAxes(ctx, WIDTH, HEIGHT, m);

    const weak = results.filter((r) => r.eye === 'weak');
    const strong = results.filter((r) => r.eye === 'strong');
    const allValues = results.map((r) => r.AULCSF);
    const maxVal = Math.max(1, ...allValues);

    const yFor = (v: number) => scaleLinear(v, [0, maxVal], [HEIGHT - m.bottom, m.top]);
    const xFor = (i: number, n: number) =>
      scaleLinear(i, [0, Math.max(1, n - 1)], [m.left + 8, WIDTH - m.right - 8]);

    const weakPoints = weak.map((r, i) => ({ x: xFor(i, weak.length), y: yFor(r.AULCSF) }));
    const strongPoints = strong.map((r, i) => ({ x: xFor(i, strong.length), y: yFor(r.AULCSF) }));

    if (weakPoints.length === strongPoints.length && weakPoints.length > 0) {
      drawGapArea(ctx, weakPoints, strongPoints, 'rgba(37, 99, 235, 0.08)');
    }
    drawLine(ctx, weakPoints, '#2563EB');
    drawLine(ctx, strongPoints, '#93C5FD', true);

    if (weak.length > 0) {
      ctx.fillStyle = '#6B7280';
      ctx.font = '10px system-ui';
      ctx.fillText(formatShortDate(weak[0].date), m.left, HEIGHT - m.bottom + 14);
      ctx.fillText(
        formatShortDate(weak[weak.length - 1].date),
        WIDTH - m.right - 30,
        HEIGHT - m.bottom + 14,
      );
    }
  }, [results]);

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-700">Contrast Sensitivity (AULCSF)</h3>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full rounded border border-gray-100" />
      <div className="mt-1 flex gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-blue-600" /> weak eye
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-blue-300" /> strong eye
        </span>
        <span>shaded = interocular difference</span>
      </div>
    </div>
  );
}
