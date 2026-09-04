import { useMemo } from 'react';
import type { Session } from '../types/session';
import type { CSFResult, VAResult, SuppressionResult } from '../types/assessment';
import { computeStreak, minutesByDay } from './chartUtils';
import { pctChange } from './milestoneUtils';

interface ProgressSummaryProps {
  sessions: Session[];
  vaResults: VAResult[];
  csfResults: CSFResult[];
  suppressionResults: SuppressionResult[];
}

interface Tile {
  label: string;
  value: string;
  detail: string | null;
  trend: 'up' | 'down' | 'flat' | null;
}

function byDateAsc<T extends { date: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.date.localeCompare(b.date));
}

const TREND_COLOR: Record<NonNullable<Tile['trend']>, string> = {
  up: 'text-green-600',
  down: 'text-amber-600',
  flat: 'text-gray-400',
};
const TREND_ARROW: Record<NonNullable<Tile['trend']>, string> = { up: '↑', down: '↓', flat: '→' };

export default function ProgressSummary({ sessions, vaResults, csfResults, suppressionResults }: ProgressSummaryProps) {
  const tiles = useMemo<Tile[]>(() => {
    const result: Tile[] = [];

    // 1. Consistency: days trained in last 30, plus current streak.
    const minutesPerDay = minutesByDay(sessions);
    const trainedDays = [...minutesPerDay.values()].filter((m) => m > 0).length;
    const streak = computeStreak(minutesPerDay);
    const last30 = [...minutesPerDay.entries()].filter(([key]) => {
      const days = (Date.now() - new Date(`${key}T00:00:00`).getTime()) / 86_400_000;
      return days >= 0 && days < 30;
    }).length;
    result.push({
      label: 'Consistency',
      value: sessions.length === 0 ? '—' : `${last30}/30 days`,
      detail: sessions.length === 0 ? 'No sessions logged yet' : `${streak}-day streak · ${trainedDays} days total`,
      trend: null,
    });

    // 2. Weak-eye VA change since start.
    const weakVA = byDateAsc(vaResults.filter((r) => r.eye === 'weak'));
    if (weakVA.length >= 2) {
      const delta = weakVA[0].logMAR - weakVA[weakVA.length - 1].logMAR;
      const trend = Math.abs(delta) < 0.02 ? 'flat' : delta > 0 ? 'up' : 'down';
      result.push({
        label: 'Weak-eye acuity',
        value: `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} logMAR`,
        detail: 'since first assessment',
        trend,
      });
    } else {
      result.push({ label: 'Weak-eye acuity', value: '—', detail: 'Needs 2+ VA assessments', trend: null });
    }

    // 3. Interocular gap trend (AULCSF, weak vs strong).
    const weakCSF = byDateAsc(csfResults.filter((r) => r.eye === 'weak'));
    const strongCSF = byDateAsc(csfResults.filter((r) => r.eye === 'strong'));
    if (weakCSF.length >= 1 && strongCSF.length >= 1 && (weakCSF.length >= 2 || strongCSF.length >= 2)) {
      const firstGap = strongCSF[0].AULCSF - weakCSF[0].AULCSF;
      const lastGap = strongCSF[strongCSF.length - 1].AULCSF - weakCSF[weakCSF.length - 1].AULCSF;
      const delta = firstGap - lastGap;
      const trend = Math.abs(delta) < 0.05 ? 'flat' : delta > 0 ? 'up' : 'down';
      result.push({
        label: 'Interocular gap',
        value: trend === 'up' ? 'Narrowing' : trend === 'down' ? 'Widening' : 'Stable',
        detail: `AULCSF gap: ${firstGap.toFixed(2)} → ${lastGap.toFixed(2)}`,
        trend,
      });
    } else {
      result.push({ label: 'Interocular gap', value: '—', detail: 'Needs CSF data for both eyes', trend: null });
    }

    // 4. Suppression trend.
    const suppression = byDateAsc(suppressionResults);
    if (suppression.length >= 2) {
      const change = pctChange(suppression[0].thresholdContrastPct, suppression[suppression.length - 1].thresholdContrastPct);
      const trend = Math.abs(change) < 2 ? 'flat' : change > 0 ? 'up' : 'down';
      result.push({
        label: 'Suppression',
        value: `${change >= 0 ? '-' : '+'}${Math.abs(Math.round(change))}%`,
        detail: 'since first assessment',
        trend,
      });
    } else {
      result.push({ label: 'Suppression', value: '—', detail: 'Needs 2+ suppression assessments', trend: null });
    }

    return result;
  }, [sessions, vaResults, csfResults, suppressionResults]);

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-700">Since you started</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">{t.label}</div>
            <div className="mt-0.5 flex items-center gap-1">
              <span className="text-base font-semibold text-gray-800">{t.value}</span>
              {t.trend && <span className={`text-sm ${TREND_COLOR[t.trend]}`}>{TREND_ARROW[t.trend]}</span>}
            </div>
            {t.detail && <div className="mt-0.5 text-[10px] text-gray-400">{t.detail}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
