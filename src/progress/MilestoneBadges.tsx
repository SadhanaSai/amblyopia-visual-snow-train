import { useMemo } from 'react';
import { MILESTONES, type Milestone, type MilestoneMetric } from '../data/milestones';
import type { StereoResult, SuppressionResult, VAResult } from '../types/assessment';
import { evaluateMilestones } from './milestoneUtils';

interface MilestoneBadgesProps {
  vaResults: VAResult[];
  stereoResults: StereoResult[];
  suppressionResults: SuppressionResult[];
}

function formatValue(metric: MilestoneMetric, value: number): string {
  switch (metric) {
    case 'logMAR_improvement':
      return `${value.toFixed(2)} logMAR gained`;
    case 'logMAR_absolute':
      return `${value.toFixed(2)} logMAR`;
    case 'stereo_arcsec':
      return `${Math.round(value)} arcsec`;
    case 'suppression_pct_change':
      return `${Math.round(value)}% reduced`;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function MilestoneCard({ milestone, achieved, achievedDate, currentValue }: ReturnType<typeof evaluateMilestones>[number]) {
  const badgeMilestone = milestone as Milestone;
  return (
    <div
      className={`rounded-lg border p-3 ${
        achieved ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs ${
            achieved ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'
          }`}
        >
          {achieved ? '✓' : '○'}
        </span>
        <div className="min-w-0">
          <div className={`text-sm font-medium ${achieved ? 'text-emerald-800' : 'text-gray-700'}`}>
            {badgeMilestone.label}
          </div>
          {achieved && achievedDate ? (
            <div className="text-xs text-emerald-600">Reached {formatDate(achievedDate)}</div>
          ) : currentValue != null ? (
            <div className="text-xs text-gray-400">Currently: {formatValue(badgeMilestone.metric, currentValue)}</div>
          ) : (
            <div className="text-xs text-gray-400">No data yet</div>
          )}
          <div className="mt-0.5 text-[10px] text-gray-400">{badgeMilestone.clinicalBasis}</div>
        </div>
      </div>
    </div>
  );
}

export default function MilestoneBadges({ vaResults, stereoResults, suppressionResults }: MilestoneBadgesProps) {
  const statuses = useMemo(
    () => evaluateMilestones(MILESTONES, { vaResults, stereoResults, suppressionResults }),
    [vaResults, stereoResults, suppressionResults],
  );

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-700">Milestones</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {statuses.map((s) => (
          <MilestoneCard key={s.milestone.id} {...s} />
        ))}
      </div>
    </div>
  );
}
