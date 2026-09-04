import { useMemo, useState } from 'react';
import { useSessionLogger } from '../hooks/useSessionLogger';
import VAChart from './VAChart';
import CSFChart from './CSFChart';
import SuppressionChart from './SuppressionChart';
import StereoChart from './StereoChart';
import ComplianceHeatmap from './ComplianceHeatmap';
import DailyTrainingLog from './DailyTrainingLog';
import { dayKey } from './chartUtils';
import type { Session } from '../types/session';

type Range = '4w' | '3m' | 'all';

const RANGE_LABELS: Record<Range, string> = { '4w': '4 weeks', '3m': '3 months', all: 'All time' };
const RANGE_DAYS: Record<Range, number | null> = { '4w': 28, '3m': 90, all: null };

function withinRange<T extends { date: string }>(items: T[], days: number | null): T[] {
  if (days === null) return items;
  const cutoff = Date.now() - days * 86_400_000;
  return items.filter((item) => new Date(item.date).getTime() >= cutoff);
}

function formatTotal(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function useTimeTotals(sessions: Session[]) {
  return useMemo(() => {
    const todayKey = dayKey(new Date());
    const weekCutoff = Date.now() - 7 * 86_400_000;
    let today = 0;
    let week = 0;
    let allTime = 0;
    for (const s of sessions) {
      const t = new Date(s.timestamp).getTime();
      allTime += s.durationSeconds;
      if (t >= weekCutoff) week += s.durationSeconds;
      if (dayKey(new Date(s.timestamp)) === todayKey) today += s.durationSeconds;
    }
    return { today, week, allTime };
  }, [sessions]);
}

function TimeTotals({ sessions }: { sessions: Session[] }) {
  const totals = useTimeTotals(sessions);
  return (
    <div className="grid grid-cols-3 gap-2">
      {(
        [
          ['Today', totals.today],
          ['This week', totals.week],
          ['All time', totals.allTime],
        ] as const
      ).map(([label, seconds]) => (
        <div key={label} className="rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-lg font-semibold text-gray-800">{formatTotal(seconds)}</div>
          <div className="text-xs text-gray-500">{label}</div>
        </div>
      ))}
    </div>
  );
}

export default function ProgressDashboard() {
  const { sessions, vaResults, csfResults, stereoResults, suppressionResults } = useSessionLogger();
  const [range, setRange] = useState<Range>('3m');
  const days = RANGE_DAYS[range];

  return (
    <div className="flex flex-col gap-6 p-4">
      <TimeTotals sessions={sessions} />

      <div className="flex justify-end gap-2">
        {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`rounded-full border px-3 py-1 text-xs ${
              range === r ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-600'
            }`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      <VAChart results={withinRange(vaResults, days)} />
      <CSFChart results={withinRange(csfResults, days)} />
      <SuppressionChart results={withinRange(suppressionResults, days)} />
      <StereoChart results={withinRange(stereoResults, days)} />
      <ComplianceHeatmap sessions={sessions} />
      <DailyTrainingLog sessions={sessions} />
    </div>
  );
}
