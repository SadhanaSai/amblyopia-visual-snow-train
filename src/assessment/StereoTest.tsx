import { useEffect, useRef, useState } from 'react';
import { useViewingCalibration } from '../hooks/useViewingCalibration';
import { useSessionLogger } from '../hooks/useSessionLogger';
import { compositeAnaglyph, drawRDS, type RDSOptions } from '../utils/canvasUtils';

const DISPARITY_LEVELS_ARCSEC = [800, 400, 200, 100, 60, 40, 20];
const TOTAL_TRIALS = 20;
const REVERSALS_AVERAGED = 4;
const CANVAS_SIZE = 320;
const TARGET_REGION_RADIUS = 80;
const HAS_GLASSES_KEY = 'has_anaglyph_glasses';

const CLINICAL_LINES = [
  { arcsec: 800, label: 'gross stereopsis' },
  { arcsec: 200, label: 'functional' },
  { arcsec: 60, label: 'good' },
  { arcsec: 40, label: 'normal' },
];

type Position = RDSOptions['targetPosition'];
const POSITIONS: { value: Position; label: string }[] = [
  { value: 'tl', label: 'Top-left' },
  { value: 'tr', label: 'Top-right' },
  { value: 'bl', label: 'Bottom-left' },
  { value: 'br', label: 'Bottom-right' },
];

/** Remaps a grayscale RDS canvas into a single anaglyph channel (red or cyan). */
function tintToChannel(source: HTMLCanvasElement, channel: 'red' | 'cyan'): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const outCtx = out.getContext('2d')!;
  const srcCtx = source.getContext('2d')!;
  const src = srcCtx.getImageData(0, 0, source.width, source.height);
  const dst = outCtx.createImageData(source.width, source.height);
  for (let i = 0; i < src.data.length; i += 4) {
    const gray = (src.data[i] + src.data[i + 1] + src.data[i + 2]) / 3;
    if (channel === 'red') {
      dst.data[i] = gray;
      dst.data[i + 1] = 0;
      dst.data[i + 2] = 0;
    } else {
      dst.data[i] = 0;
      dst.data[i + 1] = gray;
      dst.data[i + 2] = gray;
    }
    dst.data[i + 3] = 255;
  }
  outCtx.putImageData(dst, 0, 0);
  return out;
}

interface StereoTestProps {
  onComplete?: () => void;
}

export default function StereoTest({ onComplete }: StereoTestProps) {
  const { arcSecToPx } = useViewingCalibration();
  const { logStereo } = useSessionLogger();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [hasGlasses, setHasGlasses] = useState<boolean | null>(() => {
    const stored = localStorage.getItem(HAS_GLASSES_KEY);
    return stored === null ? null : stored === 'true';
  });

  const [levelIndex, setLevelIndex] = useState(0);
  const [target, setTarget] = useState<Position>('tl');
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [lastDirection, setLastDirection] = useState<'harder' | 'easier' | null>(null);
  const [reversals, setReversals] = useState<number[]>([]);
  const [trial, setTrial] = useState(0);
  const [done, setDone] = useState(false);
  const [thresholdArcsec, setThresholdArcsec] = useState<number | null>(null);

  function pickTarget(): Position {
    return POSITIONS[Math.floor(Math.random() * POSITIONS.length)].value;
  }

  useEffect(() => {
    if (hasGlasses !== true || done) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const disparityArcsec = DISPARITY_LEVELS_ARCSEC[levelIndex];
    const disparityPx = arcSecToPx(disparityArcsec);
    const seed = trial + 1;

    const left = document.createElement('canvas');
    left.width = CANVAS_SIZE;
    left.height = CANVAS_SIZE;
    drawRDS(left.getContext('2d')!, {
      disparityPx,
      targetRegionRadius: TARGET_REGION_RADIUS,
      targetPosition: target,
      eye: 'left',
      seed,
    });

    const right = document.createElement('canvas');
    right.width = CANVAS_SIZE;
    right.height = CANVAS_SIZE;
    drawRDS(right.getContext('2d')!, {
      disparityPx,
      targetRegionRadius: TARGET_REGION_RADIUS,
      targetPosition: target,
      eye: 'right',
      seed,
    });

    compositeAnaglyph(tintToChannel(left, 'red'), tintToChannel(right, 'cyan'), ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGlasses, done, levelIndex, target, trial, arcSecToPx]);

  function respond(guess: Position) {
    const correct = guess === target;
    let nextIndex = levelIndex;
    let direction: 'harder' | 'easier' = lastDirection ?? 'harder';
    let nextConsecutive = consecutiveCorrect;
    let newReversals = reversals;

    if (correct) {
      nextConsecutive = consecutiveCorrect + 1;
      if (nextConsecutive >= 2) {
        direction = 'harder';
        nextIndex = Math.min(DISPARITY_LEVELS_ARCSEC.length - 1, levelIndex + 1);
        nextConsecutive = 0;
      }
    } else {
      direction = 'easier';
      nextIndex = Math.max(0, levelIndex - 1);
      nextConsecutive = 0;
    }

    if (lastDirection && direction !== lastDirection && nextIndex !== levelIndex) {
      newReversals = [...reversals, DISPARITY_LEVELS_ARCSEC[nextIndex]];
    }

    const nextTrial = trial + 1;

    if (nextTrial >= TOTAL_TRIALS) {
      const tail = newReversals.slice(-REVERSALS_AVERAGED);
      const threshold =
        tail.length > 0
          ? tail.reduce((s, v) => s + v, 0) / tail.length
          : DISPARITY_LEVELS_ARCSEC[nextIndex];
      setThresholdArcsec(threshold);
      logStereo({ date: new Date().toISOString(), thresholdArcsec: threshold, logThreshold: Math.log10(threshold) });
      setDone(true);
      onComplete?.();
      return;
    }

    setLevelIndex(nextIndex);
    setConsecutiveCorrect(nextConsecutive);
    setLastDirection(direction);
    setReversals(newReversals);
    setTrial(nextTrial);
    setTarget(pickTarget());
  }

  if (hasGlasses === null) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Stereoacuity Test</h2>
        <p className="text-sm text-gray-600">
          This test requires red/cyan anaglyph glasses to view the depth stimulus.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(HAS_GLASSES_KEY, 'true');
              setHasGlasses(true);
            }}
            className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
          >
            I have glasses
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(HAS_GLASSES_KEY, 'false');
              setHasGlasses(false);
            }}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700"
          >
            I don't
          </button>
        </div>
      </div>
    );
  }

  if (hasGlasses === false) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Stereoacuity Test — locked</h2>
        <p className="text-sm text-gray-600">
          Red/cyan anaglyph glasses are required for this test. Once you have a pair, come back
          and re-run it.
        </p>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem(HAS_GLASSES_KEY);
            setHasGlasses(null);
          }}
          className="text-xs font-medium text-blue-600"
        >
          I have glasses now
        </button>
      </div>
    );
  }

  if (done && thresholdArcsec !== null) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Test complete</h2>
        <p className="text-sm text-gray-700">
          Threshold: <strong>{thresholdArcsec.toFixed(0)} arc-sec</strong>
        </p>
        <ul className="text-xs text-gray-500">
          {CLINICAL_LINES.map((l) => (
            <li key={l.arcsec}>
              {l.arcsec} arc-sec — {l.label}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold">Stereoacuity Test</h2>
      <div className="text-xs text-gray-400">
        Trial {trial + 1} / {TOTAL_TRIALS}
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="mx-auto rounded border border-gray-200"
      />
      <p className="text-center text-sm text-gray-600">Where is the floating circle?</p>
      <div className="grid grid-cols-2 gap-2">
        {POSITIONS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => respond(p.value)}
            className="rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
