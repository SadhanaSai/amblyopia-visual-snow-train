import type { Milestone } from '../data/milestones';
import type { StereoResult, SuppressionResult, VAResult } from '../types/assessment';

export interface MilestoneStatus {
  milestone: Milestone;
  achieved: boolean;
  achievedDate: string | null;
  /** Latest relevant value, shown as a "currently at X" hint when not yet achieved. */
  currentValue: number | null;
}

function byDateAsc<T extends { date: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.date.localeCompare(b.date));
}

/** Percent reduction from a baseline to a later reading (positive = improvement). */
export function pctChange(baseline: number, latest: number): number {
  if (baseline === 0) return 0;
  return ((baseline - latest) / baseline) * 100;
}

export function evaluateMilestones(
  milestones: Milestone[],
  data: { vaResults: VAResult[]; stereoResults: StereoResult[]; suppressionResults: SuppressionResult[] },
): MilestoneStatus[] {
  const weakVA = byDateAsc(data.vaResults.filter((r) => r.eye === 'weak'));
  const stereo = byDateAsc(data.stereoResults.filter((r) => !r.noMeasurableStereopsis));
  const suppression = byDateAsc(data.suppressionResults);

  return milestones.map((milestone) => {
    switch (milestone.metric) {
      case 'logMAR_improvement': {
        if (weakVA.length === 0) return { milestone, achieved: false, achievedDate: null, currentValue: null };
        const baseline = weakVA[0].logMAR;
        const achieving = weakVA.find((r) => baseline - r.logMAR >= milestone.threshold);
        return {
          milestone,
          achieved: !!achieving,
          achievedDate: achieving?.date ?? null,
          currentValue: baseline - weakVA[weakVA.length - 1].logMAR,
        };
      }
      case 'logMAR_absolute': {
        if (weakVA.length === 0) return { milestone, achieved: false, achievedDate: null, currentValue: null };
        const achieving = weakVA.find((r) => r.logMAR <= milestone.threshold);
        return {
          milestone,
          achieved: !!achieving,
          achievedDate: achieving?.date ?? null,
          currentValue: weakVA[weakVA.length - 1].logMAR,
        };
      }
      case 'stereo_arcsec': {
        if (stereo.length === 0) return { milestone, achieved: false, achievedDate: null, currentValue: null };
        const achieving = stereo.find((r) => r.thresholdArcsec <= milestone.threshold);
        return {
          milestone,
          achieved: !!achieving,
          achievedDate: achieving?.date ?? null,
          currentValue: stereo[stereo.length - 1].thresholdArcsec,
        };
      }
      case 'suppression_pct_change': {
        if (suppression.length === 0) return { milestone, achieved: false, achievedDate: null, currentValue: null };
        const baseline = suppression[0].thresholdContrastPct;
        const achieving = suppression.find(
          (r) => pctChange(baseline, r.thresholdContrastPct) >= milestone.threshold,
        );
        return {
          milestone,
          achieved: !!achieving,
          achievedDate: achieving?.date ?? null,
          currentValue: pctChange(baseline, suppression[suppression.length - 1].thresholdContrastPct),
        };
      }
      default:
        return { milestone, achieved: false, achievedDate: null, currentValue: null };
    }
  });
}
