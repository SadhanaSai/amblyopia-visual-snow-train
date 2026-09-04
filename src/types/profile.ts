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

/**
 * Which physical lens the weak eye looks through. Molded anaglyph glasses
 * (unlike flat paper ones) can't be reoriented to put a specific color over
 * a specific eye — which eye gets red vs. the other color is fixed by the
 * glasses, not chosen by the wearer. So instead of instructing users to
 * "flip the glasses" until the weak eye sees red, the app asks which lens
 * is actually over the weak eye and renders that eye's full-strength
 * content in the matching color.
 */
export type WeakEyeChannel = 'red' | 'other';

export const DEFAULT_WEAK_EYE_CHANNEL: WeakEyeChannel = 'red';

export interface CalibrationData {
  ppmm: number;
  referenceObject: string;
  inrDenomination?: number;
  calibratedAt: string; // ISO8601
  viewingDistanceMm: number;
  /** window.devicePixelRatio at the moment calibration was saved — lets later code
   * detect a browser zoom change, which alters the CSS-px-to-mm mapping `ppmm` was
   * derived from without changing any CSS-px layout measurement. Optional for
   * backward compatibility with calibrations saved before this field existed. */
  devicePixelRatioAtCalibration?: number;
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
  /** Optional for backward compatibility — treat missing as DEFAULT_WEAK_EYE_CHANNEL. */
  weakEyeChannel?: WeakEyeChannel;
}

/** Strabismic and combined mechanism amblyopia enable eccentric-fixation training. */
export function fixationStabilityApplicable(diagnosis: Diagnosis): boolean {
  return diagnosis === 'strabismic' || diagnosis === 'combined';
}
