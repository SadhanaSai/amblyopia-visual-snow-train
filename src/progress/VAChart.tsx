import { useEffect, useRef } from 'react';
import type { VAResult } from '../types/assessment';
import { MILESTONES } from '../data/milestones';
import { DEFAULT_MARGIN, drawAxes, drawHLine, drawLine, formatShortDate, scaleLinear } from './chartUtils';

const WIDTH = 640;
const HEIGHT = 240;
const LOGMAR_BEST = -0.1;
const LOGMAR_WORST = 1.0;

interface VAChartProps {
  results: VAResult[];
}

export default function VAChart({ results }: VAChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const m = DEFAULT_MARGIN;
    drawAxes(ctx, WIDTH, HEIGHT, m);

    const yFor = (logMAR: number) =>
      scaleLinear(logMAR, [LOGMAR_BEST, LOGMAR_WORST], [m.top, HEIGHT - m.bottom]);

    drawHLine(ctx, yFor(0.1), m.left, WIDTH - m.right, '#F59E0B', 'near normal (0.1)');
    drawHLine(ctx, yFor(0.3), m.left, WIDTH - m.right, '#F97316', 'moderate (0.3)');

    const weak = results.filter((r) => r.eye === 'weak');
    const strong = results.filter((r) => r.eye === 'strong');
    const xFor = (i: number, n: number) =>
      scaleLinear(i, [0, Math.max(1, n - 1)], [m.left + 8, WIDTH - m.right - 8]);

    drawLine(
      ctx,
      weak.map((r, i) => ({ x: xFor(i, weak.length), y: yFor(r.logMAR) })),
      '#2563EB',
    );
    drawLine(
      ctx,
      strong.map((r, i) => ({ x: xFor(i, strong.length), y: yFor(r.logMAR) })),
      '#93C5FD',
      true,
    );

    if (weak.length > 0) {
      const first = weak[0].logMAR;
      for (const milestone of MILESTONES) {
        if (milestone.metric !== 'logMAR_improvement' && milestone.metric !== 'logMAR_absolute') continue;
        const idx = weak.findIndex((r) =>
          milestone.metric === 'logMAR_improvement'
            ? first - r.logMAR >= milestone.threshold
            : r.logMAR <= milestone.threshold,
        );
        if (idx === -1) continue;
        const x = xFor(idx, weak.length);
        ctx.strokeStyle = '#10B981';
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(x, m.top);
        ctx.lineTo(x, HEIGHT - m.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.fillStyle = '#6B7280';
    ctx.font = '10px system-ui';
    ctx.fillText('1 line = 0.1 logMAR', m.left, HEIGHT - 4);
    if (weak.length > 0) {
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
      <h3 className="mb-2 text-sm font-semibold text-gray-700">Visual Acuity</h3>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full rounded border border-gray-100" />
      <div className="mt-1 flex gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-blue-600" /> weak eye
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-blue-300" /> strong eye
        </span>
      </div>
    </div>
  );
}
