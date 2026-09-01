export type StaircaseType = '2down1up' | '3down1up' | 'quest_plus';

export interface StaircaseConfig {
  type: StaircaseType;
  startValue: number;
  stepSize: number;
  stepSizeAfterReversal: number;
  minReversals: number;
  minValue: number;
  maxValue: number;
  logScale: boolean;
}

export interface StaircaseState {
  currentValue: number;
  reversals: number[];
  responses: boolean[];
  threshold: number | null;
  complete: boolean;
}
