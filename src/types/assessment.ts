export type TestedEye = 'weak' | 'strong';

export interface VAResult {
  date: string;
  logMAR: number;
  lettersCorrectPerRow: Record<string, number>;
  eye: TestedEye;
  ppmm: number;
}

export interface CSFResult {
  date: string;
  eye: TestedEye;
  sf_1cpd: number;
  sf_2cpd: number;
  sf_4cpd: number;
  sf_8cpd: number;
  sf_16cpd: number;
  AULCSF: number;
}

export interface StereoResult {
  date: string;
  thresholdArcsec: number;
  logThreshold: number;
  /** True when the test stopped early because the posterior concluded the
   * participant can't reliably discriminate even the largest tested
   * disparity, rather than because a real threshold converged. When true,
   * thresholdArcsec is the largest tested disparity (a floor, not a fit). */
  noMeasurableStereopsis?: boolean;
  /** Posterior mean lapse rate from the fitted psychometric function. */
  lapseRate?: number;
}

export interface SuppressionResult {
  date: string;
  thresholdContrastPct: number;
}
