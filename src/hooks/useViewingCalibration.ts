import { useCallback, useEffect, useState } from 'react';
import type { CalibrationData } from '../types/profile';

const STORAGE_KEY = 'calibration';
const VIEWING_DISTANCE_MM = 400; // fixed 40cm per protocol
const RECALIBRATION_DAYS = 28; // "every 4 weeks or on device change"

function loadCalibration(): CalibrationData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CalibrationData;
    if (parsed.devicePixelRatioAtCalibration == null) {
      // Calibration saved before zoom detection existed — its real zoom level
      // at calibration time is unknowable, so adopt the current one as the
      // baseline rather than never being able to detect a future zoom change.
      const migrated: CalibrationData = {
        ...parsed,
        devicePixelRatioAtCalibration: window.devicePixelRatio,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return parsed;
  } catch {
    return null;
  }
}

// Browser zoom (e.g. Cmd/Ctrl + '+') changes window.devicePixelRatio without
// changing any CSS-px layout measurement, so it silently invalidates `ppmm`
// (which is "CSS px per mm at the zoom level active during calibration") with
// no resize/visualViewport event to catch it. matchMedia on the current dppx
// is the standard way to get notified: it fires once the ratio no longer
// matches, at which point we read the new ratio and re-subscribe at that value.
function useLiveDevicePixelRatio(): number {
  const [dpr, setDpr] = useState(() => window.devicePixelRatio);

  useEffect(() => {
    let mql: MediaQueryList | undefined;
    function subscribe() {
      mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mql.addEventListener('change', handleChange);
    }
    function handleChange() {
      setDpr(window.devicePixelRatio);
      mql?.removeEventListener('change', handleChange);
      subscribe();
    }
    subscribe();
    return () => mql?.removeEventListener('change', handleChange);
  }, []);

  return dpr;
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
  /** True once browser zoom has changed since calibration was saved — `ppmm` is stale. */
  zoomChanged: boolean;
  degToPx: (degrees: number) => number;
  arcSecToPx: (arcsec: number) => number;
  /** Inverse of arcSecToPx: the visual angle, in arc-seconds, that a given pixel offset subtends at the calibrated viewing distance. */
  pxToArcSec: (px: number) => number;
  mmToPx: (mm: number) => number;
  saveCalibration: (data: NewCalibrationInput) => void;
  clearCalibration: () => void;
}

export function useViewingCalibration(): UseViewingCalibrationReturn {
  const [calibration, setCalibrationState] = useState<CalibrationData | null>(() =>
    loadCalibration(),
  );

  const ppmm = calibration?.ppmm ?? 0;
  const liveDpr = useLiveDevicePixelRatio();

  const degToPx = useCallback(
    (degrees: number) => Math.tan((degrees * Math.PI) / 180) * VIEWING_DISTANCE_MM * ppmm,
    [ppmm],
  );
  const arcSecToPx = useCallback((arcsec: number) => degToPx(arcsec / 3600), [degToPx]);
  const pxToArcSec = useCallback(
    (px: number) => {
      if (ppmm <= 0) return Infinity; // uncalibrated: no pixel offset can be trusted to represent any angle
      const degrees = (Math.atan(px / (VIEWING_DISTANCE_MM * ppmm)) * 180) / Math.PI;
      return degrees * 3600;
    },
    [ppmm],
  );
  const mmToPx = useCallback((mm: number) => mm * ppmm, [ppmm]);

  const saveCalibration = useCallback((data: NewCalibrationInput) => {
    const full: CalibrationData = {
      ...data,
      calibratedAt: new Date().toISOString(),
      viewingDistanceMm: VIEWING_DISTANCE_MM,
      devicePixelRatioAtCalibration: window.devicePixelRatio,
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
    zoomChanged:
      calibration?.devicePixelRatioAtCalibration != null &&
      Math.abs(liveDpr - calibration.devicePixelRatioAtCalibration) > 0.01,
    degToPx,
    arcSecToPx,
    pxToArcSec,
    mmToPx,
    saveCalibration,
    clearCalibration,
  };
}
