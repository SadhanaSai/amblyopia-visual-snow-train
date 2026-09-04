import { useMemo, useState } from 'react';
import { useSessionLogger } from '../hooks/useSessionLogger';
import VAChart from './VAChart';
import CSFChart from './CSFChart';
import SuppressionChart from './SuppressionChart';
import StereoChart from './StereoChart';
import ComplianceHeatmap from './ComplianceHeatmap';
import DailyTrainingLog from './DailyTrainingLog';
import DailyAccuracyTrend from './DailyAccuracyTrend';
import MilestoneBadges from './MilestoneBadges';
import ProgressSummary from './ProgressSummary';
import { dayKey, formatDurationCompact } from './chartUtils';
import { assessmentsToCSV, downloadCsv, sessionsToCSV } from './exportCsv';
import type { Session } from '../types/session';

type Range = '4w' | '3m' | 'all';

const RANGE_LABELS: Record<Range, string> = { '4w': '4 weeks', '3m': '3 months', all: 'All time' };
const RANGE_DAYS: Record<Range, number | null> = { '4w': 28, '3m': 90, all: null };

function withinRange<T>(items: T[], days: number | null, getDate: (item: T) => string): T[] {
  if (days === null) return items;
  const cutoff = Date.now() - days * 86_400_000;
  return items.filter((item) => new Date(getDate(item)).getTime() >= cutoff);
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
          <div className="text-lg font-semibold text-gray-800">{formatDurationCompact(seconds)}</div>
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

  function handleExportCsv() {
    downloadCsv(`sessions-${dayKey(new Date())}.csv`, sessionsToCSV(sessions));
    downloadCsv(`assessments-${dayKey(new Date())}.csv`, assessmentsToCSV({ vaResults, csfResults, stereoResults, suppressionResults }));
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <TimeTotals sessions={sessions} />
      <ProgressSummary
        sessions={sessions}
        vaResults={vaResults}
        csfResults={csfResults}
        suppressionResults={suppressionResults}
      />
      <DailyAccuracyTrend sessions={sessions} />
      <MilestoneBadges vaResults={vaResults} stereoResults={stereoResults} suppressionResults={suppressionResults} />

      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={handleExportCsv} className="text-xs font-medium text-blue-600">
          Download CSV
        </button>
        <div className="flex gap-2">
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
      </div>

      <VAChart results={withinRange(vaResults, days, (r) => r.date)} />
      <CSFChart results={withinRange(csfResults, days, (r) => r.date)} />
      <SuppressionChart results={withinRange(suppressionResults, days, (r) => r.date)} />
      <StereoChart results={withinRange(stereoResults, days, (r) => r.date)} />
      <DailyTrainingLog sessions={withinRange(sessions, days, (s) => s.timestamp)} />
      {/* Compliance heatmap always shows the full year regardless of the range
          picker — it's a long-range-only view by design, like GitHub's contribution graph. */}
      <ComplianceHeatmap sessions={sessions} />
    </div>
  );
}
