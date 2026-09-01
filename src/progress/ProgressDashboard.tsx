import { useState } from 'react';
import { useSessionLogger } from '../hooks/useSessionLogger';
import VAChart from './VAChart';
import CSFChart from './CSFChart';
import SuppressionChart from './SuppressionChart';
import StereoChart from './StereoChart';
import ComplianceHeatmap from './ComplianceHeatmap';

type Range = '4w' | '3m' | 'all';

const RANGE_LABELS: Record<Range, string> = { '4w': '4 weeks', '3m': '3 months', all: 'All time' };
const RANGE_DAYS: Record<Range, number | null> = { '4w': 28, '3m': 90, all: null };

function withinRange<T extends { date: string }>(items: T[], days: number | null): T[] {
  if (days === null) return items;
  const cutoff = Date.now() - days * 86_400_000;
  return items.filter((item) => new Date(item.date).getTime() >= cutoff);
}

export default function ProgressDashboard() {
  const { sessions, vaResults, csfResults, stereoResults, suppressionResults } = useSessionLogger();
  const [range, setRange] = useState<Range>('3m');
  const days = RANGE_DAYS[range];

  return (
    <div className="flex flex-col gap-6 p-4">
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
    </div>
  );
}
