import { useMemo } from 'react';
import { useSessionLogger } from '../hooks/useSessionLogger';
import { TRAINING_EXERCISES } from '../data/trainingExercises';
import { computeStreak, dayKey, formatDurationCompact, minutesByDay } from '../progress/chartUtils';

/** Live checklist of today's exercises, shown on the Train tab's exercise
 * picker (not inside a running exercise, where a full-screen canvas task
 * has no room for it) — so "how am I doing today" is visible without
 * leaving the training flow to check the Progress tab. */
export default function TodayProgress() {
  const { sessions } = useSessionLogger();

  const { doneKeys, todaySeconds, streak } = useMemo(() => {
    const todayKey = dayKey(new Date());
    const doneKeys = new Set<string>();
    let todaySeconds = 0;
    for (const s of sessions) {
      if ((s.module === 'dichoptic' || s.module === 'nopt') && dayKey(new Date(s.timestamp)) === todayKey) {
        doneKeys.add(s.exercise);
        todaySeconds += s.durationSeconds;
      }
    }
    return { doneKeys, todaySeconds, streak: computeStreak(minutesByDay(sessions)) };
  }, [sessions]);

  const doneCount = TRAINING_EXERCISES.filter((e) => doneKeys.has(e.key)).length;

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-800">Today</div>
        <div className="text-xs text-gray-500">
          {streak} day{streak === 1 ? '' : 's'} streak
        </div>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        {doneCount} of {TRAINING_EXERCISES.length} exercises
        {todaySeconds > 0 && ` · ${formatDurationCompact(todaySeconds)}`}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {TRAINING_EXERCISES.map((e) => (
          <span
            key={e.key}
            className={`rounded-full px-2.5 py-1 text-xs ${
              doneKeys.has(e.key) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {doneKeys.has(e.key) ? '✓ ' : ''}
            {e.label}
          </span>
        ))}
      </div>
    </div>
  );
}
