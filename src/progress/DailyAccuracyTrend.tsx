import { useMemo } from 'react';
import type { Session } from '../types/session';
import { labelForExercise } from '../data/trainingExercises';
import { dayKey } from './chartUtils';

interface ExerciseTrend {
  exercise: string;
  label: string;
  todayAccuracy: number;
  todayTrials: number;
  previousAccuracy: number | null;
}

const ARROW_UP = '↑';
const ARROW_DOWN = '↓';
const ARROW_FLAT = '→';
const FLAT_THRESHOLD = 0.02;

function average(sessions: Session[]): number {
  return sessions.reduce((sum, s) => sum + (s.accuracy ?? 0), 0) / sessions.length;
}

/** Today's per-exercise accuracy against the most recent earlier day that
 * exercise was practiced — a same-session-to-session comparison, not a
 * long-range trend (see the VA/CSF/etc. charts below for that). Only
 * exercises with a numeric `accuracy` (a 0-1 fraction, always "higher is
 * better") are shown — exercises that log a staircase threshold instead
 * have no shared, unambiguous "better" direction to arrow against. */
export default function DailyAccuracyTrend({ sessions }: { sessions: Session[] }) {
  const trends = useMemo<ExerciseTrend[]>(() => {
    const todayKey = dayKey(new Date());
    const byExercise = new Map<string, Session[]>();
    for (const s of sessions) {
      if (s.accuracy == null) continue;
      if (!byExercise.has(s.exercise)) byExercise.set(s.exercise, []);
      byExercise.get(s.exercise)!.push(s);
    }

    const result: ExerciseTrend[] = [];
    for (const [exercise, list] of byExercise) {
      const today = list.filter((s) => dayKey(new Date(s.timestamp)) === todayKey);
      if (today.length === 0) continue;

      const priorByDay = new Map<string, Session[]>();
      for (const s of list) {
        const key = dayKey(new Date(s.timestamp));
        if (key === todayKey) continue;
        if (!priorByDay.has(key)) priorByDay.set(key, []);
        priorByDay.get(key)!.push(s);
      }
      const mostRecentPriorKey = Array.from(priorByDay.keys()).sort().pop() ?? null;

      result.push({
        exercise,
        label: labelForExercise(exercise),
        todayAccuracy: average(today),
        todayTrials: today.reduce((sum, s) => sum + s.trials, 0),
        previousAccuracy: mostRecentPriorKey ? average(priorByDay.get(mostRecentPriorKey)!) : null,
      });
    }
    return result.sort((a, b) => a.label.localeCompare(b.label));
  }, [sessions]);

  if (trends.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-700">Today's accuracy vs. last session</h3>
      <div className="flex flex-col gap-2">
        {trends.map((t) => {
          const delta = t.previousAccuracy == null ? null : t.todayAccuracy - t.previousAccuracy;
          const arrow =
            delta == null ? null : Math.abs(delta) < FLAT_THRESHOLD ? ARROW_FLAT : delta > 0 ? ARROW_UP : ARROW_DOWN;
          const arrowColor =
            arrow === ARROW_UP ? 'text-green-600' : arrow === ARROW_DOWN ? 'text-amber-600' : 'text-gray-400';
          return (
            <div
              key={t.exercise}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
            >
              <div>
                <div className="text-sm font-medium text-gray-800">{t.label}</div>
                <div className="text-xs text-gray-400">
                  {t.todayTrials} trial{t.todayTrials === 1 ? '' : 's'} today
                  {t.previousAccuracy != null && ` · was ${Math.round(t.previousAccuracy * 100)}% last session`}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-gray-800">
                  {Math.round(t.todayAccuracy * 100)}%
                </span>
                {arrow && <span className={`text-lg ${arrowColor}`}>{arrow}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
