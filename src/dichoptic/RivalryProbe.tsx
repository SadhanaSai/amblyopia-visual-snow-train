import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfile } from '../profile/ProfileContext';
import { useViewingCalibration } from '../hooks/useViewingCalibration';
import { useSessionLogger } from '../hooks/useSessionLogger';
import { useStaircase } from '../hooks/useStaircase';
import { useResponsiveSquareCanvas } from '../hooks/useResponsiveSquareCanvas';
import { compositeAnaglyph, drawSinusoidalGrating } from '../utils/canvasUtils';
import { strongChannel, weakChannel } from '../utils/colorUtils';
import type { StaircaseConfig } from '../types/staircase';

const PROBE_MS = 200;
const RESPONSE_WINDOW_MS = 500;
const JITTER_MIN_MS = 3000;
const JITTER_MAX_MS = 7000;

const CONFIG: StaircaseConfig = {
  type: '2down1up',
  startValue: 0.5,
  stepSize: 0.1,
  stepSizeAfterReversal: 0.05,
  minReversals: 6,
  minValue: 0.02,
  maxValue: 0.9,
  logScale: false,
};

type Mode = 'training' | 'assessment';

interface RivalryProbeProps {
  mode?: Mode;
  onComplete?: () => void;
}

/** Dual role per spec: 8-min training block or 5-min standalone assessment — both log to sessions AND suppressionResults. */
export default function RivalryProbe({ mode = 'training', onComplete }: RivalryProbeProps) {
  const { profile } = useProfile();
  const { degToPx } = useViewingCalibration();
  const { logSession, logSuppression } = useSessionLogger();
  const staircase = useStaircase(CONFIG);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { containerRef, size } = useResponsiveSquareCanvas();

  const durationSec = mode === 'assessment' ? 300 : 480;

  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [probeCount, setProbeCount] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [falseAlarms, setFalseAlarms] = useState(0);
  const [done, setDone] = useState(false);

  const respondedRef = useRef(false);
  const probeWindowOpenRef = useRef(false);

  const pxPerDeg = degToPx(1);
  const apertureSigmaPx = degToPx(3);

  const drawBackground = useCallback(
    (probeContrast: number | null) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const strong = document.createElement('canvas');
      strong.width = canvas.width;
      strong.height = canvas.height;
      drawSinusoidalGrating(strong.getContext('2d')!, {
        spatialFrequencyCpd: 2,
        contrast: 0.9,
        orientation: 0,
        phase: 0,
        apertureSigmaPx,
        color: strongChannel(profile),
        pxPerDeg,
      });
      const weak = document.createElement('canvas');
      weak.width = canvas.width;
      weak.height = canvas.height;
      if (probeContrast !== null) {
        drawSinusoidalGrating(weak.getContext('2d')!, {
          spatialFrequencyCpd: 2,
          contrast: probeContrast,
          orientation: 90,
          phase: 0,
          apertureSigmaPx,
          color: weakChannel(profile),
          pxPerDeg,
        });
      }
      compositeAnaglyph(weak, strong, ctx);
    },
    [apertureSigmaPx, pxPerDeg, profile.lensType, profile.weakEyeChannel],
  );

  function finish() {
    setRunning(false);
    setDone(true);
    const threshold = staircase.state.threshold ?? staircase.currentValue;
    logSuppression({ date: new Date().toISOString(), thresholdContrastPct: threshold * 100 });
    logSession({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      module: mode === 'assessment' ? 'assessment' : 'dichoptic',
      exercise: 'RivalryProbe',
      displayMode: 'anaglyph',
      weakEye: profile.weakEye,
      durationSeconds: elapsed,
      trials: probeCount,
      accuracy: probeCount > 0 ? hits / probeCount : undefined,
      staircaseThreshold: threshold,
      thresholdUnit: 'Michelson contrast',
      notes: `mode=${mode} falseAlarms=${falseAlarms}`,
    });
    // onComplete is deferred to the "Done" button on the complete screen,
    // not called here — see VATest.tsx for why.
  }

  useEffect(() => {
    if (!running || done) return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [running, done]);

  useEffect(() => {
    if (running && elapsed >= durationSec) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, running, durationSec]);

  // Probe scheduling: fires after a 3-7s jittered delay, visible 200ms,
  // response window open for 500ms from onset.
  useEffect(() => {
    if (!running || done) return;
    let cancelled = false;
    let probeTimeout: number | undefined;
    let hideTimeout: number | undefined;
    let windowTimeout: number | undefined;

    function scheduleNext() {
      const delay = JITTER_MIN_MS + Math.random() * (JITTER_MAX_MS - JITTER_MIN_MS);
      probeTimeout = window.setTimeout(fireProbe, delay);
    }

    function fireProbe() {
      if (cancelled) return;
      respondedRef.current = false;
      probeWindowOpenRef.current = true;
      setProbeCount((c) => c + 1);
      drawBackground(staircase.currentValue);

      hideTimeout = window.setTimeout(() => {
        drawBackground(null);
      }, PROBE_MS);

      windowTimeout = window.setTimeout(() => {
        probeWindowOpenRef.current = false;
        if (!respondedRef.current) {
          setMisses((m) => m + 1);
          staircase.respond(false);
        }
        if (!cancelled) scheduleNext();
      }, RESPONSE_WINDOW_MS);
    }

    drawBackground(null);
    scheduleNext();

    return () => {
      cancelled = true;
      if (probeTimeout !== undefined) window.clearTimeout(probeTimeout);
      if (hideTimeout !== undefined) window.clearTimeout(hideTimeout);
      if (windowTimeout !== undefined) window.clearTimeout(windowTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, done, drawBackground, size]);

  useEffect(() => {
    if (!running || done) return;
    function onKey(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (probeWindowOpenRef.current && !respondedRef.current) {
        respondedRef.current = true;
        setHits((h) => h + 1);
        staircase.respond(true);
      } else if (!probeWindowOpenRef.current) {
        setFalseAlarms((f) => f + 1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, done]);

  if (done) {
    const threshold = staircase.state.threshold ?? staircase.currentValue;
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Session complete</h2>
        <p className="text-sm text-gray-700">
          Suppression threshold: {(threshold * 100).toFixed(1)}%
        </p>
        <p className="text-xs text-gray-500">Lower = less suppression = treatment working.</p>
        <p className="text-xs text-gray-400">
          Hits {hits} · Misses {misses} · False alarms {falseAlarms}
        </p>
        <button
          type="button"
          onClick={() => onComplete?.()}
          className="mt-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Done
        </button>
      </div>
    );
  }

  if (!running) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Binocular Rivalry Suppression Probe</h2>
        <p className="text-sm text-gray-600">
          A horizontal grating will stay visible to your strong eye. Press spacebar the moment
          you glimpse a faint vertical probe.
        </p>
        <button
          type="button"
          onClick={() => setRunning(true)}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Start ({mode === 'assessment' ? '5 min' : '8 min'})
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      <div className="flex justify-between text-xs text-gray-400">
        <span>
          {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')} /{' '}
          {Math.floor(durationSec / 60)}:00
        </span>
        <span>
          Probes: {probeCount}
          {probeCount > 0 && ` · ${hits} hit${hits === 1 ? '' : 's'}`}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${Math.min(100, (elapsed / durationSec) * 100)}%` }}
        />
      </div>
      <div ref={containerRef} className="relative mx-auto aspect-square w-full">
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          className="absolute inset-0 h-full w-full rounded border border-gray-200 bg-black"
        />
      </div>
      <p className="text-center text-xs text-gray-500">Press spacebar when you see the probe.</p>
    </div>
  );
}
