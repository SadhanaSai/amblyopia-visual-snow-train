export type WeakEye = 'left' | 'right';

export type Diagnosis = 'anisometropic' | 'strabismic' | 'combined' | 'unspecified';

/**
 * Which anaglyph glasses the user has. Real red/green and red/cyan lenses
 * pass different non-red wavelengths, so the app's non-red channel color
 * has to match the physical lens or that channel leaks/dims through the
 * "blocked" eye instead of fully separating (see colorUtils.ts).
 */
export type LensType = 'red-cyan' | 'red-green';

export const DEFAULT_LENS_TYPE: LensType = 'red-cyan';

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
  /** Optional for backward compatibility with profiles saved before this field existed — treat missing as DEFAULT_LENS_TYPE. */
  lensType?: LensType;
}

/** Strabismic and combined mechanism amblyopia enable eccentric-fixation training. */
export function fixationStabilityApplicable(diagnosis: Diagnosis): boolean {
  return diagnosis === 'strabismic' || diagnosis === 'combined';
}
