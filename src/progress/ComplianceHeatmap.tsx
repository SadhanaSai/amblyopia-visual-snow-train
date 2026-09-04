import { useEffect, useMemo, useRef } from 'react';
import type { Session } from '../types/session';
import ChartCard from './ChartCard';
import { computeStreak, dayKey, minutesByDay } from './chartUtils';

const WEEKS = 52;
const DAYS = 7;
const CELL = 10;
const GAP = 2;
const WIDTH = WEEKS * (CELL + GAP);
const HEIGHT = DAYS * (CELL + GAP);

function colorForMinutes(minutes: number): string {
  if (minutes <= 0) return '#F3F4F6';
  if (minutes < 5) return '#BFDBFE';
  if (minutes < 15) return '#60A5FA';
  return '#2563EB';
}

interface ComplianceHeatmapProps {
  sessions: Session[];
}

export default function ComplianceHeatmap({ sessions }: ComplianceHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const minutesPerDay = useMemo(() => minutesByDay(sessions), [sessions]);

  const streak = useMemo(() => computeStreak(minutesPerDay), [minutesPerDay]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Backing buffer must scale with devicePixelRatio or the browser upscales
    // a flat WIDTH×HEIGHT bitmap on any HiDPI screen, blurring every cell edge.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = `${WIDTH}px`;
    canvas.style.height = `${HEIGHT}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Anchor the LAST column to the week containing today (its Sunday), then
    // step back (WEEKS - 1) more full weeks for the first column. Anchoring
    // from the start date instead — going forward WEEKS*DAYS days from an
    // aligned start — overshot past today by up to 6 days whenever today
    // wasn't a Sunday, silently pushing today off the end of the grid so it,
    // and the rest of the current week, never got drawn at all.
    const todayWeekday = today.getDay();
    const start = new Date(today);
    start.setDate(start.getDate() - todayWeekday);
    start.setDate(start.getDate() - (WEEKS - 1) * DAYS);

    for (let col = 0; col < WEEKS; col++) {
      for (let row = 0; row < DAYS; row++) {
        const date = new Date(start);
        date.setDate(date.getDate() + col * DAYS + row);
        if (date > today) continue;
        const minutes = minutesPerDay.get(dayKey(date)) ?? 0;
        ctx.fillStyle = colorForMinutes(minutes);
        ctx.fillRect(col * (CELL + GAP), row * (CELL + GAP), CELL, CELL);
      }
    }
  }, [minutesPerDay]);

  return (
    <ChartCard
      title="Compliance"
      headerRight={
        <span className="text-xs text-gray-500">
          {streak} day{streak === 1 ? '' : 's'} streak
        </span>
      }
      footer={
        <span className="flex items-center gap-2">
          <span>Less</span>
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: '#F3F4F6' }} />
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: '#BFDBFE' }} />
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: '#60A5FA' }} />
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: '#2563EB' }} />
          <span>More</span>
        </span>
      }
    >
      <div className="overflow-x-auto">
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} />
      </div>
    </ChartCard>
  );
}
