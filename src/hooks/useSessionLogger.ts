import { useCallback, useState } from 'react';
import type { Session } from '../types/session';
import type { CSFResult, StereoResult, SuppressionResult, VAResult } from '../types/assessment';

const KEYS = {
  sessions: 'sessions',
  va: 'va_results',
  csf: 'csf_results',
  stereo: 'stereo_results',
  suppression: 'suppression_results',
} as const;

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function persist<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

export interface UseSessionLoggerReturn {
  logSession: (s: Session) => void;
  logVA: (r: VAResult) => void;
  logCSF: (r: CSFResult) => void;
  logStereo: (r: StereoResult) => void;
  logSuppression: (r: SuppressionResult) => void;
  sessions: Session[];
  vaResults: VAResult[];
  csfResults: CSFResult[];
  stereoResults: StereoResult[];
  suppressionResults: SuppressionResult[];
}

export function useSessionLogger(): UseSessionLoggerReturn {
  const [sessions, setSessions] = useState<Session[]>(() => load<Session>(KEYS.sessions));
  const [vaResults, setVaResults] = useState<VAResult[]>(() => load<VAResult>(KEYS.va));
  const [csfResults, setCsfResults] = useState<CSFResult[]>(() => load<CSFResult>(KEYS.csf));
  const [stereoResults, setStereoResults] = useState<StereoResult[]>(() =>
    load<StereoResult>(KEYS.stereo),
  );
  const [suppressionResults, setSuppressionResults] = useState<SuppressionResult[]>(() =>
    load<SuppressionResult>(KEYS.suppression),
  );

  const logSession = useCallback((s: Session) => {
    setSessions((prev) => {
      const next = [...prev, s];
      persist(KEYS.sessions, next);
      return next;
    });
  }, []);

  const logVA = useCallback((r: VAResult) => {
    setVaResults((prev) => {
      const next = [...prev, r];
      persist(KEYS.va, next);
      return next;
    });
  }, []);

  const logCSF = useCallback((r: CSFResult) => {
    setCsfResults((prev) => {
      const next = [...prev, r];
      persist(KEYS.csf, next);
      return next;
    });
  }, []);

  const logStereo = useCallback((r: StereoResult) => {
    setStereoResults((prev) => {
      const next = [...prev, r];
      persist(KEYS.stereo, next);
      return next;
    });
  }, []);

  const logSuppression = useCallback((r: SuppressionResult) => {
    setSuppressionResults((prev) => {
      const next = [...prev, r];
      persist(KEYS.suppression, next);
      return next;
    });
  }, []);

  return {
    logSession,
    logVA,
    logCSF,
    logStereo,
    logSuppression,
    sessions,
    vaResults,
    csfResults,
    stereoResults,
    suppressionResults,
  };
}
