export type MilestoneMetric =
  | 'logMAR_improvement'
  | 'logMAR_absolute'
  | 'stereo_arcsec'
  | 'suppression_pct_change';

export interface Milestone {
  id: string;
  metric: MilestoneMetric;
  threshold: number;
  label: string;
  clinicalBasis: string;
}

export const MILESTONES: Milestone[] = [
  {
    id: 'va_1line',
    metric: 'logMAR_improvement',
    threshold: 0.1,
    label: '1-line improvement',
    clinicalBasis: 'CureSight RCT 2022: >=0.1 logMAR = measurable improvement',
  },
  {
    id: 'va_2line',
    metric: 'logMAR_improvement',
    threshold: 0.2,
    label: '2-line improvement',
    clinicalBasis: 'CureSight success criterion: >=0.2 logMAR improvement',
  },
  {
    id: 'va_near_normal',
    metric: 'logMAR_absolute',
    threshold: 0.1,
    label: 'Near-normal acuity',
    clinicalBasis: 'Bynocs 2024: <=0.1 logMAR amblyopic eye = treatment success',
  },
  {
    id: 'stereo_gross',
    metric: 'stereo_arcsec',
    threshold: 200,
    label: 'Gross stereopsis detected',
    clinicalBasis: 'Clinical threshold for measurable depth perception',
  },
  {
    id: 'stereo_functional',
    metric: 'stereo_arcsec',
    threshold: 60,
    label: 'Functional stereoacuity',
    clinicalBasis: 'Near-normal range boundary',
  },
  {
    id: 'suppression_halved',
    metric: 'suppression_pct_change',
    threshold: 50,
    label: 'Suppression halved',
    clinicalBasis: '50% reduction in suppression depth threshold',
  },
];
