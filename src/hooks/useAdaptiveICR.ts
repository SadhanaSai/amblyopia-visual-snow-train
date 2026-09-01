import { useCallback, useState } from 'react';

const STORAGE_KEY = 'adaptive_icr';
const DEFAULT_ICR = 0.3; // Hess et al. 2010 starting ratio
const ICR_MIN = 0.1;
const ICR_MAX = 1.0;
const ICR_STEP = 0.05;
const HISTORY_LENGTH = 3; // "across last 3 sessions"

interface ICRStore {
  currentICR: number;
  recentThresholds: number[]; // oldest first, capped at HISTORY_LENGTH
}

function loadStore(): ICRStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ICRStore;
  } catch {
    // corrupt storage — fall through to default
  }
  return { currentICR: DEFAULT_ICR, recentThresholds: [] };
}

function persistStore(store: ICRStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export type ICRTrend = 'improving' | 'stable' | 'regressing';

function computeTrend(recentThresholds: number[]): ICRTrend {
  if (recentThresholds.length < HISTORY_LENGTH) return 'stable';
  const window = recentThresholds.slice(-HISTORY_LENGTH);
  if (window[window.length - 1] === window[0]) return 'stable';
  const rising = window.every((v, i) => i === 0 || v >= window[i - 1]);
  if (rising) return 'improving';
  const falling = window.every((v, i) => i === 0 || v <= window[i - 1]);
  if (falling) return 'regressing';
  return 'stable';
}

export interface UseAdaptiveICRReturn {
  currentICR: number;
  balanceLevel: number; // 1-10 display value
  trend: ICRTrend;
  updateFromSession: (thresholdICR: number) => void;
  setManualICR: (icr: number) => void;
}

export function useAdaptiveICR(): UseAdaptiveICRReturn {
  const [store, setStore] = useState<ICRStore>(() => loadStore());

  const updateFromSession = useCallback((thresholdICR: number) => {
    setStore((prev) => {
      const recentThresholds = [...prev.recentThresholds, thresholdICR].slice(-HISTORY_LENGTH);
      const trend = computeTrend(recentThresholds);
      // Improving -> nudge ICR up 0.05; stable/regressing both hold (regressing
      // is surfaced to the user via `trend`, not auto-corrected).
      const currentICR =
        trend === 'improving'
          ? Math.min(ICR_MAX, Math.round((prev.currentICR + ICR_STEP) * 100) / 100)
          : prev.currentICR;
      const next = { currentICR, recentThresholds };
      persistStore(next);
      return next;
    });
  }, []);

  const setManualICR = useCallback((icr: number) => {
    setStore((prev) => {
      const next = { ...prev, currentICR: Math.min(ICR_MAX, Math.max(ICR_MIN, icr)) };
      persistStore(next);
      return next;
    });
  }, []);

  return {
    currentICR: store.currentICR,
    balanceLevel: Math.round(store.currentICR * 10),
    trend: computeTrend(store.recentThresholds),
    updateFromSession,
    setManualICR,
  };
}
