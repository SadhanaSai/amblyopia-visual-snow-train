import { useMemo, useState } from 'react';
import type { Session } from '../types/session';
import { dayKey } from './chartUtils';

const INCOMPLETE_NOTE = 'incomplete — exited before finishing';
const INITIAL_DAYS_SHOWN = 14;

interface DayEntry {
  key: string;
  label: string;
  totalSeconds: number;
  exercises: { exercise: string; seconds: number; partial: boolean }[];
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function formatDayLabel(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

interface DailyTrainingLogProps {
  sessions: Session[];
}

/** Per-day, per-exercise time breakdown, built from the same Session[] as ComplianceHeatmap. */
export default function DailyTrainingLog({ sessions }: DailyTrainingLogProps) {
  const [expanded, setExpanded] = useState(false);

  const days = useMemo<DayEntry[]>(() => {
    const byDay = new Map<string, Map<string, { seconds: number; partial: boolean }>>();
    for (const s of sessions) {
      const key = dayKey(new Date(s.timestamp));
      if (!byDay.has(key)) byDay.set(key, new Map());
      const dayMap = byDay.get(key)!;
      const existing = dayMap.get(s.exercise) ?? { seconds: 0, partial: false };
      existing.seconds += s.durationSeconds;
      if (s.notes?.includes(INCOMPLETE_NOTE)) existing.partial = true;
      dayMap.set(s.exercise, existing);
    }
    return Array.from(byDay.entries())
      .map(([key, dayMap]) => {
        const exercises = Array.from(dayMap.entries())
          .map(([exercise, v]) => ({ exercise, seconds: v.seconds, partial: v.partial }))
          .sort((a, b) => b.seconds - a.seconds);
        const totalSeconds = exercises.reduce((sum, e) => sum + e.seconds, 0);
        return { key, label: formatDayLabel(key), totalSeconds, exercises };
      })
      .sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [sessions]);

  if (days.length === 0) {
    return (
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Daily training log</h3>
        <p className="text-xs text-gray-400">No sessions logged yet.</p>
      </div>
    );
  }

  const visibleDays = expanded ? days : days.slice(0, INITIAL_DAYS_SHOWN);

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-700">Daily training log</h3>
      <div className="flex flex-col gap-3">
        {visibleDays.map((day) => (
          <div key={day.key} className="rounded-lg border border-gray-200 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800">{day.label}</span>
              <span className="text-xs text-gray-500">{formatDuration(day.totalSeconds)}</span>
            </div>
            <ul className="flex flex-col gap-1">
              {day.exercises.map((e) => (
                <li key={e.exercise} className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {e.exercise}
                    {e.partial && (
                      <span className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700">
                        partial
                      </span>
                    )}
                  </span>
                  <span>{formatDuration(e.seconds)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {days.length > INITIAL_DAYS_SHOWN && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 text-xs font-medium text-blue-600"
        >
          {expanded ? 'Show less' : `Show all ${days.length} days`}
        </button>
      )}
    </div>
  );
}
