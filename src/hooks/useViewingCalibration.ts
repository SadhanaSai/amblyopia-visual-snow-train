import { useCallback, useState } from 'react';
import type { CalibrationData } from '../types/profile';

const STORAGE_KEY = 'calibration';
const VIEWING_DISTANCE_MM = 400; // fixed 40cm per protocol
const RECALIBRATION_DAYS = 28; // "every 4 weeks or on device change"

function loadCalibration(): CalibrationData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CalibrationData) : null;
  } catch {
    return null;
  }
}

export interface NewCalibrationInput {
  ppmm: number;
  referenceObject: string;
  inrDenomination?: number;
}

export interface UseViewingCalibrationReturn {
  ppmm: number;
  calibration: CalibrationData | null;
  isCalibrated: boolean;
  daysSinceCalibration: number | null;
  needsRecalibration: boolean;
  degToPx: (degrees: number) => number;
  arcSecToPx: (arcsec: number) => number;
  mmToPx: (mm: number) => number;
  saveCalibration: (data: NewCalibrationInput) => void;
  clearCalibration: () => void;
}

export function useViewingCalibration(): UseViewingCalibrationReturn {
  const [calibration, setCalibrationState] = useState<CalibrationData | null>(() =>
    loadCalibration(),
  );

  const ppmm = calibration?.ppmm ?? 0;

  const degToPx = useCallback(
    (degrees: number) => Math.tan((degrees * Math.PI) / 180) * VIEWING_DISTANCE_MM * ppmm,
    [ppmm],
  );
  const arcSecToPx = useCallback((arcsec: number) => degToPx(arcsec / 3600), [degToPx]);
  const mmToPx = useCallback((mm: number) => mm * ppmm, [ppmm]);

  const saveCalibration = useCallback((data: NewCalibrationInput) => {
    const full: CalibrationData = {
      ...data,
      calibratedAt: new Date().toISOString(),
      viewingDistanceMm: VIEWING_DISTANCE_MM,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
    setCalibrationState(full);
  }, []);

  const clearCalibration = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCalibrationState(null);
  }, []);

  const daysSinceCalibration = calibration
    ? Math.floor((Date.now() - new Date(calibration.calibratedAt).getTime()) / 86_400_000)
    : null;

  return {
    ppmm,
    calibration,
    isCalibrated: calibration !== null,
    daysSinceCalibration,
    needsRecalibration:
      daysSinceCalibration !== null && daysSinceCalibration >= RECALIBRATION_DAYS,
    degToPx,
    arcSecToPx,
    mmToPx,
    saveCalibration,
    clearCalibration,
  };
}
