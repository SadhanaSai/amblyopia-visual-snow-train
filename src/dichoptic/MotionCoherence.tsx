import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfile } from '../profile/ProfileContext';
import { useViewingCalibration } from '../hooks/useViewingCalibration';
import { useSessionLogger } from '../hooks/useSessionLogger';
import { useStaircase } from '../hooks/useStaircase';
import { useAdaptiveICR } from '../hooks/useAdaptiveICR';
import {
  compositeAnaglyph,
  createRDK,
  drawRDK,
  stepRDK,
  type RDKConfig,
  type RDKState,
} from '../utils/canvasUtils';
import { strongChannel, weakChannel } from '../utils/colorUtils';
import type { StaircaseConfig } from '../types/staircase';

const SPEEDS = [3, 6, 12] as const;
const DIRECTIONS = [0, 45, 90, 135, 180, 225, 270, 315];
const MAX_TRIALS = 80;
const VIEWING_MS = 1500;
const CANVAS_SIZE = 320;
const DOT_DENSITY_PER_DEG2 = 3;
const FIELD_DIAMETER_DEG = 8;
const DOT_RADIUS_PX = 2.5;
const DOT_LIFETIME_FRAMES = 12; // ~200ms at 60fps

const CONFIG: StaircaseConfig = {
  type: '3down1up',
  startValue: 0.4,
  stepSize: 0.1,
  stepSizeAfterReversal: 0.05,
  minReversals: 6,
  minValue: 0.05,
  maxValue: 0.8,
  logScale: false,
};

type Phase = 'setup' | 'viewing' | 'response' | 'done';

interface MotionCoherenceProps {
  onComplete?: () => void;
}

export default function MotionCoherence({ onComplete }: MotionCoherenceProps) {
  const { profile } = useProfile();
  const { degToPx } = useViewingCalibration();
  const { logSession } = useSessionLogger();
  const adaptiveICR = useAdaptiveICR();
  const staircase = useStaircase(CONFIG);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const coherentStateRef = useRef<RDKState | null>(null);
  const noiseStateRef = useRef<RDKState | null>(null);
  const lastFrameTimeRef = useRef(0);

  const startedAtRef = useRef(performance.now());
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(6);
  const [phase, setPhase] = useState<Phase>('setup');
  const [direction, setDirection] = useState(0);
  const [trial, setTrial] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [directionErrors, setDirectionErrors] = useState<Record<number, number>>({});

  const pxPerDeg = degToPx(1);

  function buildLayers(coherenceFraction: number, directionDeg: number): {
    coherent: RDKState;
    noise: RDKState;
  } {
    const fieldDiameterPx = degToPx(FIELD_DIAMETER_DEG);
    const totalDots = Math.round(DOT_DENSITY_PER_DEG2 * Math.PI * (FIELD_DIAMETER_DEG / 2) ** 2);
    const coherentCount = Math.round(totalDots * coherenceFraction);
    const noiseCount = totalDots - coherentCount;

    const base: Omit<RDKConfig, 'nDots' | 'coherence' | 'eye' | 'icr'> = {
      directionDeg,
      speedDegPerSec: speed,
      dotLifetimeFrames: DOT_LIFETIME_FRAMES,
      fieldDiameterPx,
      dotRadiusPx: DOT_RADIUS_PX,
      weakEyeColor: weakChannel(profile),
    };

    const coherent = createRDK(
      { ...base, nDots: coherentCount, coherence: 1, eye: 'weak', icr: 1 },
      pxPerDeg,
    );
    const noise = createRDK(
      { ...base, nDots: noiseCount, coherence: 0, eye: 'weak', icr: adaptiveICR.currentICR },
      pxPerDeg,
    );
    return { coherent, noise };
  }

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !coherentStateRef.current || !noiseStateRef.current) return;
    const weak = document.createElement('canvas');
    weak.width = canvas.width;
    weak.height = canvas.height;
    const strong = document.createElement('canvas');
    strong.width = canvas.width;
    strong.height = canvas.height;
    const weakCtx = weak.getContext('2d')!;
    const strongCtx = strong.getContext('2d')!;

    const strongEyeColor = strongChannel(profile);

    // Coherent (signal) dots: weak eye only, full contrast.
    drawRDK(weakCtx, coherentStateRef.current);
    // Noise dots: identical field drawn into both eyes at ICR-blended contrast.
    drawRDK(weakCtx, { ...noiseStateRef.current, config: { ...noiseStateRef.current.config, eye: 'weak' } });
    drawRDK(strongCtx, {
      ...noiseStateRef.current,
      config: { ...noiseStateRef.current.config, eye: 'strong', strongEyeColor },
    });

    compositeAnaglyph(weak, strong, ctx);
  }, [profile.lensType, profile.weakEyeChannel]);

  const startTrial = useCallback(() => {
    const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    setDirection(dir);
    const { coherent, noise } = buildLayers(staircase.currentValue, dir);
    coherentStateRef.current = coherent;
    noiseStateRef.current = noise;
    lastFrameTimeRef.current = performance.now();
    setPhase('viewing');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staircase.currentValue, speed, pxPerDeg, adaptiveICR.currentICR]);

  useEffect(() => {
    if (phase !== 'viewing') return;
    let stop = false;

    function tick(now: number) {
      if (stop) return;
      const dt = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;
      if (coherentStateRef.current) coherentStateRef.current = stepRDK(coherentStateRef.current, dt);
      if (noiseStateRef.current) noiseStateRef.current = stepRDK(noiseStateRef.current, dt);
      renderFrame();
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    const stopTimeout = window.setTimeout(() => {
      stop = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      setPhase('response');
    }, VIEWING_MS);

    return () => {
      stop = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.clearTimeout(stopTimeout);
    };
  }, [phase, renderFrame]);

  function finish(finalTrial: number, finalCorrect: number) {
    const threshold = staircase.state.threshold ?? staircase.currentValue;
    logSession({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      module: 'dichoptic',
      exercise: 'MotionCoherence',
      displayMode: 'anaglyph',
      weakEye: profile.weakEye,
      durationSeconds: Math.round((performance.now() - startedAtRef.current) / 1000),
      trials: finalTrial,
      accuracy: finalCorrect / Math.max(1, finalTrial),
      staircaseThreshold: threshold,
      thresholdUnit: 'coherence fraction',
      notes: `speed=${speed}deg/s directionErrors=${JSON.stringify(directionErrors)}`,
    });
    setPhase('done');
    onComplete?.();
  }

  function respond(pressedDirection: number) {
    const correct = pressedDirection === direction;
    staircase.respond(correct);
    const nextTrial = trial + 1;
    const nextCorrect = correct ? correctCount + 1 : correctCount;
    if (!correct) {
      setDirectionErrors((prev) => ({ ...prev, [direction]: (prev[direction] ?? 0) + 1 }));
    }
    setTrial(nextTrial);
    setCorrectCount(nextCorrect);

    if (nextTrial >= MAX_TRIALS || staircase.state.complete) {
      finish(nextTrial, nextCorrect);
    } else {
      startTrial();
    }
  }

  useEffect(() => {
    if (phase !== 'response') return;
    function onKey(e: KeyboardEvent) {
      const num = Number(e.key);
      if (num >= 1 && num <= 8) respond(DIRECTIONS[num - 1]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === 'setup') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Dichoptic Global Motion Coherence</h2>
        <div>
          <div className="mb-1 text-xs font-medium text-gray-500">Speed</div>
          <div className="flex gap-2">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  speed === s ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
                }`}
              >
                {s}°/s
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            startedAtRef.current = performance.now();
            startTrial();
          }}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Start
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Session complete</h2>
        <p className="text-sm text-gray-700">
          Coherence threshold: {((staircase.state.threshold ?? staircase.currentValue) * 100).toFixed(0)}%
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <div className="text-xs text-gray-400">
        Trial {trial + 1} / {MAX_TRIALS}
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="mx-auto rounded border border-gray-200 bg-black"
      />
      {phase === 'response' && (
        <div>
          <p className="mb-2 text-center text-sm text-gray-600">
            Which direction did most dots move? Press 1–8.
          </p>
          <div className="mx-auto grid max-w-xs grid-cols-4 gap-1 text-center text-xs text-gray-500">
            {DIRECTIONS.map((d, i) => (
              <div key={d}>
                {i + 1}: {d}°
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
