import { useEffect, useMemo, useRef } from 'react';
import type { Session } from '../types/session';
import { dayKey, minutesByDay } from './chartUtils';

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

  const streak = useMemo(() => {
    let count = 0;
    const cursor = new Date();
    for (;;) {
      const key = dayKey(cursor);
      if ((minutesPerDay.get(key) ?? 0) > 0) {
        count++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }, [minutesPerDay]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalDays = WEEKS * DAYS;
    const start = new Date(today);
    start.setDate(start.getDate() - (totalDays - 1));
    // Align start to the same weekday as today so columns read as full weeks.
    const startWeekday = start.getDay();
    start.setDate(start.getDate() - startWeekday);

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
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Compliance</h3>
        <span className="text-xs text-gray-500">
          {streak} day{streak === 1 ? '' : 's'} streak
        </span>
      </div>
      <div className="overflow-x-auto">
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} />
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
        <span>Less</span>
        <span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: '#F3F4F6' }} />
        <span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: '#BFDBFE' }} />
        <span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: '#60A5FA' }} />
        <span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: '#2563EB' }} />
        <span>More</span>
      </div>
    </div>
  );
}
