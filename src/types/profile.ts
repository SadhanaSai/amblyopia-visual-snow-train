export type WeakEye = 'left' | 'right';

export type Diagnosis = 'anisometropic' | 'strabismic' | 'combined' | 'unspecified';

export interface CalibrationData {
  ppmm: number;
  referenceObject: string;
  inrDenomination?: number;
  calibratedAt: string; // ISO8601
  viewingDistanceMm: number;
}

export interface UserProfile {
  weakEye: WeakEye;
  diagnosis: Diagnosis;
  photosensitiveEpilepsy: boolean;
  strabismusSurgeryRecent: boolean;
  clinicianConsulted: boolean;
  onboardingComplete: boolean;
  calibration: CalibrationData | null;
  createdAt: string;
}

/** Strabismic and combined mechanism amblyopia enable eccentric-fixation training. */
export function fixationStabilityApplicable(diagnosis: Diagnosis): boolean {
  return diagnosis === 'strabismic' || diagnosis === 'combined';
}
