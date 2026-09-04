import { useCallback, useSyncExternalStore } from 'react';
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

// Every component that calls useSessionLogger() gets its own useState instance
// backed by the same localStorage, but writes from one instance (e.g. an
// assessment component) were previously invisible to any other instance
// already mounted (e.g. the tab showing "last run" summaries) until a full
// remount. Keeping one shared, subscribable store fixes that: every mounted
// consumer re-renders as soon as any of them logs a result.
const store = {
  sessions: load<Session>(KEYS.sessions),
  va: load<VAResult>(KEYS.va),
  csf: load<CSFResult>(KEYS.csf),
  stereo: load<StereoResult>(KEYS.stereo),
  suppression: load<SuppressionResult>(KEYS.suppression),
};

const listeners = new Set<() => void>();
function notify(): void {
  for (const l of listeners) l();
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function appendSession(item: Session): void {
  store.sessions = [...store.sessions, item];
  persist(KEYS.sessions, store.sessions);
  notify();
}
function appendVA(item: VAResult): void {
  store.va = [...store.va, item];
  persist(KEYS.va, store.va);
  notify();
}
function appendCSF(item: CSFResult): void {
  store.csf = [...store.csf, item];
  persist(KEYS.csf, store.csf);
  notify();
}
function appendStereo(item: StereoResult): void {
  store.stereo = [...store.stereo, item];
  persist(KEYS.stereo, store.stereo);
  notify();
}
function appendSuppression(item: SuppressionResult): void {
  store.suppression = [...store.suppression, item];
  persist(KEYS.suppression, store.suppression);
  notify();
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
  const sessions = useSyncExternalStore(subscribe, () => store.sessions);
  const vaResults = useSyncExternalStore(subscribe, () => store.va);
  const csfResults = useSyncExternalStore(subscribe, () => store.csf);
  const stereoResults = useSyncExternalStore(subscribe, () => store.stereo);
  const suppressionResults = useSyncExternalStore(subscribe, () => store.suppression);

  const logSession = useCallback((s: Session) => appendSession(s), []);
  const logVA = useCallback((r: VAResult) => appendVA(r), []);
  const logCSF = useCallback((r: CSFResult) => appendCSF(r), []);
  const logStereo = useCallback((r: StereoResult) => appendStereo(r), []);
  const logSuppression = useCallback((r: SuppressionResult) => appendSuppression(r), []);

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
