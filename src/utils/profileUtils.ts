import { DEFAULT_LENS_TYPE, type UserProfile } from '../types/profile';

const STORAGE_KEY = 'profile';

export function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function createDefaultProfile(): UserProfile {
  return {
    weakEye: 'left',
    diagnosis: 'unspecified',
    photosensitiveEpilepsy: false,
    strabismusSurgeryRecent: false,
    clinicianConsulted: false,
    onboardingComplete: false,
    calibration: null,
    createdAt: new Date().toISOString(),
    lensType: DEFAULT_LENS_TYPE,
  };
}

export function clearProfile(): void {
  localStorage.removeItem(STORAGE_KEY);
}
