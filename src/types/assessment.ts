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
}

export interface SuppressionResult {
  date: string;
  thresholdContrastPct: number;
}
