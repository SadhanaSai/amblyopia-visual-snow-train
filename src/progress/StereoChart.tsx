import { useEffect, useRef } from 'react';
import type { StereoResult } from '../types/assessment';
import { DEFAULT_MARGIN, drawAxes, drawHLine, drawLine, formatShortDate, scaleLinear } from './chartUtils';

const WIDTH = 640;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (results.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const m = DEFAULT_MARGIN;
    drawAxes(ctx, WIDTH, HEIGHT, m);

    const yFor = (logValue: number) =>
      scaleLinear(logValue, [LOG_BEST, LOG_WORST], [m.top, HEIGHT - m.bottom]);

    for (const line of CLINICAL_LINES) {
      drawHLine(ctx, yFor(Math.log10(line.arcsec)), m.left, WIDTH - m.right, '#D1D5DB', line.label);
    }

    const xFor = (i: number, n: number) =>
      scaleLinear(i, [0, Math.max(1, n - 1)], [m.left + 8, WIDTH - m.right - 8]);
    const points = results.map((r, i) => ({ x: xFor(i, results.length), y: yFor(r.logThreshold) }));
    drawLine(ctx, points, '#2563EB');

    ctx.fillStyle = '#6B7280';
    ctx.font = '10px system-ui';
    ctx.fillText(formatShortDate(results[0].date), m.left, HEIGHT - m.bottom + 14);
    ctx.fillText(
      formatShortDate(results[results.length - 1].date),
      WIDTH - m.right - 30,
      HEIGHT - m.bottom + 14,
    );
  }, [results]);

  if (results.length === 0) {
    return (
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Stereoacuity</h3>
        <p className="text-xs text-gray-400">Run the Stereo Test (requires anaglyph glasses) to see this chart.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-700">Stereoacuity</h3>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full rounded border border-gray-100" />
      <div className="mt-1 text-xs text-gray-400">Lower arc-seconds = better</div>
    </div>
  );
}
