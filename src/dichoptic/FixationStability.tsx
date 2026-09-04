import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfile } from '../profile/ProfileContext';
import { useViewingCalibration } from '../hooks/useViewingCalibration';
import { useSessionLogger } from '../hooks/useSessionLogger';
import { useAdaptiveICR } from '../hooks/useAdaptiveICR';
import { fixationStabilityApplicable } from '../types/profile';
import { applyICR, channelRgb, channelToRgbString, strongChannel, weakChannel } from '../utils/colorUtils';
import { compositeAnaglyph } from '../utils/canvasUtils';

const RUNS = 4;
const RUN_SECONDS = 30;
const REST_SECONDS = 10;
const CANVAS_SIZE = 320;
const DISTRACTOR_MS = 200;
const DISTRACTOR_MIN_GAP_MS = 800;
const DISTRACTOR_MAX_GAP_MS = 2500;
const MIN_ECCENTRICITY_DEG = 5;
const MAX_ECCENTRICITY_DEG = 15;

type Phase = 'not-applicable' | 'setup' | 'running' | 'rating' | 'rest' | 'done';

interface FixationStabilityProps {
  onComplete?: () => void;
}

export default function FixationStability({ onComplete }: FixationStabilityProps) {
  const { profile } = useProfile();
  const { degToPx } = useViewingCalibration();
  const { logSession } = useSessionLogger();
  const adaptiveICR = useAdaptiveICR();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const applicable = fixationStabilityApplicable(profile.diagnosis);
  const runStartedAtRef = useRef(performance.now());
  const [phase, setPhase] = useState<Phase>(applicable ? 'setup' : 'not-applicable');
  const [runIndex, setRunIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(RUN_SECONDS);
  const [ratings, setRatings] = useState<number[]>([]);

  const pxPerDeg = degToPx(1);

  const drawStatic = useCallback(
    (distractor: { xPx: number; yPx: number } | null) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      const weak = document.createElement('canvas');
      weak.width = canvas.width;
      weak.height = canvas.height;
      const strong = document.createElement('canvas');
      strong.width = canvas.width;
      strong.height = canvas.height;
      const weakCtx = weak.getContext('2d')!;
      const strongCtx = strong.getContext('2d')!;

      // Central fixation cross — weak eye.
      const weakColor = channelToRgbString(weakChannel(profile));
      weakCtx.strokeStyle = weakColor;
      weakCtx.lineWidth = 2;
      weakCtx.beginPath();
      weakCtx.moveTo(cx - 6, cy);
      weakCtx.lineTo(cx + 6, cy);
      weakCtx.moveTo(cx, cy - 6);
      weakCtx.lineTo(cx, cy + 6);
      weakCtx.stroke();

      if (distractor) {
        weakCtx.fillStyle = weakColor;
        weakCtx.beginPath();
        weakCtx.arc(distractor.xPx, distractor.yPx, 3, 0, Math.PI * 2);
        weakCtx.fill();
      }

      // Surround ring — strong eye, ICR contrast.
      strongCtx.strokeStyle = applyICR(channelRgb(strongChannel(profile)), adaptiveICR.currentICR);
      strongCtx.lineWidth = 2;
      strongCtx.beginPath();
      strongCtx.arc(cx, cy, 80, 0, Math.PI * 2);
      strongCtx.stroke();

      compositeAnaglyph(weak, strong, ctx);
    },
    [adaptiveICR.currentICR, profile.lensType, profile.weakEyeChannel],
  );

  // Countdown timer for the active run.
  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          setPhase('rating');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  // Distractor scheduling + idle redraw during a run.
  useEffect(() => {
    if (phase !== 'running') return;
    let cancelled = false;
    let timeoutId: number | undefined;
    drawStatic(null);

    function scheduleNext() {
      const delay =
        DISTRACTOR_MIN_GAP_MS + Math.random() * (DISTRACTOR_MAX_GAP_MS - DISTRACTOR_MIN_GAP_MS);
      timeoutId = window.setTimeout(fireDistractor, delay);
    }

    function fireDistractor() {
      if (cancelled) return;
      const eccentricityDeg =
        MIN_ECCENTRICITY_DEG + Math.random() * (MAX_ECCENTRICITY_DEG - MIN_ECCENTRICITY_DEG);
      const angle = Math.random() * Math.PI * 2;
      const radiusPx = degToPx(eccentricityDeg);
      const canvas = canvasRef.current;
      const cx = (canvas?.width ?? CANVAS_SIZE) / 2;
      const cy = (canvas?.height ?? CANVAS_SIZE) / 2;
      const distractor = {
        xPx: cx + radiusPx * Math.cos(angle),
        yPx: cy + radiusPx * Math.sin(angle),
      };
      drawStatic(distractor);
      window.setTimeout(() => {
        if (!cancelled) drawStatic(null);
      }, DISTRACTOR_MS);
      scheduleNext();
    }

    scheduleNext();
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, drawStatic, pxPerDeg]);

  function startRun() {
    runStartedAtRef.current = performance.now();
    setSecondsLeft(RUN_SECONDS);
    setPhase('running');
  }

  function submitRating(rating: number) {
    logSession({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      module: 'dichoptic',
      exercise: 'FixationStability',
      displayMode: 'anaglyph',
      weakEye: profile.weakEye,
      durationSeconds: Math.round((performance.now() - runStartedAtRef.current) / 1000),
      trials: 1,
      icrUsed: adaptiveICR.currentICR,
      selfRating: { pre: 0, post: rating },
      notes: `run=${runIndex + 1}/${RUNS}`,
    });
    const nextRatings = [...ratings, rating];
    setRatings(nextRatings);

    if (runIndex + 1 >= RUNS) {
      setPhase('done');
      onComplete?.();
    } else {
      setRunIndex(runIndex + 1);
      setSecondsLeft(REST_SECONDS);
      setPhase('rest');
    }
  }

  useEffect(() => {
    if (phase !== 'rest') return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          startRun();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === 'not-applicable') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Fixation Stability Training</h2>
        <p className="text-sm text-gray-600">
          Not applicable for your profile — this exercise is only offered for strabismic or
          combined-mechanism amblyopia.
        </p>
      </div>
    );
  }

  if (phase === 'setup') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Fixation Stability Training</h2>
        <p className="text-sm text-gray-600">
          Hold your gaze on the central cross for four 30-second runs, with a 10-second rest
          between each. No response is needed — just keep looking at the cross.
        </p>
        <button
          type="button"
          onClick={startRun}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Start
        </button>
      </div>
    );
  }

  if (phase === 'rating') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">How difficult was that run?</h2>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => submitRating(r)}
              className="h-12 w-12 rounded-full border border-gray-300 text-sm font-medium"
            >
              {r}
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-gray-400">1 = easy, 5 = very difficult</p>
      </div>
    );
  }

  if (phase === 'rest') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-6">
        <h2 className="text-lg font-semibold">Rest</h2>
        <p className="text-3xl font-semibold text-gray-700">{secondsLeft}s</p>
        <p className="text-sm text-gray-500">
          Run {runIndex + 1} of {RUNS} coming up
        </p>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Session complete</h2>
        <p className="text-sm text-gray-700">
          Average difficulty: {(ratings.reduce((s, r) => s + r, 0) / Math.max(1, ratings.length)).toFixed(1)} / 5
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <div className="flex justify-between text-xs text-gray-400">
        <span>
          Run {runIndex + 1} / {RUNS}
        </span>
        <span>{secondsLeft}s</span>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="mx-auto rounded border border-gray-200 bg-black"
      />
      <p className="text-center text-xs text-gray-500">Keep your gaze on the central cross.</p>
    </div>
  );
}
