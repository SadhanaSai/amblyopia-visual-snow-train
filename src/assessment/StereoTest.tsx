import { useEffect, useRef, useState } from 'react';
import { useProfile } from '../profile/ProfileContext';
import { useViewingCalibration } from '../hooks/useViewingCalibration';
import { useSessionLogger } from '../hooks/useSessionLogger';
import { compositeAnaglyph, drawRDS, type RDSOptions } from '../utils/canvasUtils';
import {
  ENTROPY_STOP_BITS,
  MAX_TRIALS,
  MIN_TRIALS,
  NO_STEREOPSIS_PROBABILITY,
  initStereoPosterior,
  marginalThresholdEntropy,
  meanLapseRate,
  meanLogThreshold,
  probabilityNoStereopsis,
  selectNextStereoStimulus,
  updateStereoPosterior,
  type StereoPosterior,
} from '../utils/stereoQuest';

const DISPARITY_LEVELS_ARCSEC = [800, 400, 200, 100, 60, 40, 20];
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

/** Remaps a grayscale RDS canvas into a single anaglyph channel (red, cyan, or green). */
function tintToChannel(source: HTMLCanvasElement, channel: 'red' | 'cyan' | 'green'): HTMLCanvasElement {
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
    } else if (channel === 'green') {
      dst.data[i] = 0;
      dst.data[i + 1] = gray;
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

function pickTarget(): Position {
  return POSITIONS[Math.floor(Math.random() * POSITIONS.length)].value;
}

interface StereoTestProps {
  onComplete?: () => void;
}

export default function StereoTest({ onComplete }: StereoTestProps) {
  const { profile } = useProfile();
  const { arcSecToPx } = useViewingCalibration();
  const { logStereo, logSession } = useSessionLogger();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedAtRef = useRef(performance.now());

  const [hasGlasses, setHasGlasses] = useState<boolean | null>(() => {
    const stored = localStorage.getItem(HAS_GLASSES_KEY);
    return stored === null ? null : stored === 'true';
  });

  const [posterior, setPosterior] = useState<StereoPosterior>(() => initStereoPosterior());
  const [currentArcsec, setCurrentArcsec] = useState<number>(() =>
    selectNextStereoStimulus(initStereoPosterior(), DISPARITY_LEVELS_ARCSEC),
  );
  const [target, setTarget] = useState<Position>(pickTarget);
  const [trial, setTrial] = useState(0);
  const [done, setDone] = useState(false);
  const [thresholdArcsec, setThresholdArcsec] = useState<number | null>(null);
  const [noStereopsis, setNoStereopsis] = useState(false);

  useEffect(() => {
    if (hasGlasses !== true || done) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const disparityPx = arcSecToPx(currentArcsec);
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

    const strongChannel = profile.lensType === 'red-green' ? 'green' : 'cyan';
    compositeAnaglyph(tintToChannel(left, 'red'), tintToChannel(right, strongChannel), ctx);
  }, [hasGlasses, done, currentArcsec, target, trial, arcSecToPx, profile.lensType]);

  function respond(guess: Position) {
    const correct = guess === target;
    const nextPosterior = updateStereoPosterior(posterior, currentArcsec, correct);
    const nextTrial = trial + 1;

    // Bayesian lapse-rate stopping rule (Wichmann & Hill, 2001 psychometric
    // form — see stereoQuest.ts): stop once the posterior is either
    // confidently converged on a real threshold (low entropy) or has
    // concluded the participant can't reliably discriminate even the
    // largest tested disparity (high probability mass at/beyond the floor)
    // — whichever comes first, after a minimum number of trials, with a
    // fixed max as a safety net regardless of convergence.
    const entropy = marginalThresholdEntropy(nextPosterior);
    const pNoStereopsis = probabilityNoStereopsis(nextPosterior, DISPARITY_LEVELS_ARCSEC[0]);
    const converged = entropy <= ENTROPY_STOP_BITS || pNoStereopsis >= NO_STEREOPSIS_PROBABILITY;
    const shouldStop = nextTrial >= MAX_TRIALS || (nextTrial >= MIN_TRIALS && converged);

    if (shouldStop) {
      const isNoStereopsis = pNoStereopsis >= NO_STEREOPSIS_PROBABILITY;
      const smallestTested = DISPARITY_LEVELS_ARCSEC[DISPARITY_LEVELS_ARCSEC.length - 1];
      const largestTested = DISPARITY_LEVELS_ARCSEC[0];
      const rawMean = Math.pow(10, meanLogThreshold(nextPosterior));
      const finalArcsec = isNoStereopsis
        ? largestTested
        : Math.min(largestTested, Math.max(smallestTested, rawMean));
      const lapseRate = meanLapseRate(nextPosterior);

      logStereo({
        date: new Date().toISOString(),
        thresholdArcsec: finalArcsec,
        logThreshold: Math.log10(finalArcsec),
        noMeasurableStereopsis: isNoStereopsis,
        lapseRate,
      });
      logSession({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        module: 'assessment',
        exercise: 'StereoTest',
        weakEye: profile.weakEye,
        durationSeconds: Math.round((performance.now() - startedAtRef.current) / 1000),
        trials: nextTrial,
        staircaseThreshold: finalArcsec,
        thresholdUnit: 'arcsec',
        notes: isNoStereopsis ? 'noMeasurableStereopsis=true' : undefined,
      });
      setPosterior(nextPosterior);
      setThresholdArcsec(finalArcsec);
      setNoStereopsis(isNoStereopsis);
      setTrial(nextTrial);
      setDone(true);
      // onComplete is deferred to the "Done" button on the complete
      // screen, not called here — see VATest.tsx for why.
      return;
    }

    setPosterior(nextPosterior);
    setTrial(nextTrial);
    setCurrentArcsec(selectNextStereoStimulus(nextPosterior, DISPARITY_LEVELS_ARCSEC));
    setTarget(pickTarget());
  }

  if (hasGlasses === null) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Stereoacuity Test</h2>
        <p className="text-sm text-gray-600">
          This test requires red/cyan or red/green anaglyph glasses to view the depth stimulus.
          Set which kind you have under Settings → Lens type.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(HAS_GLASSES_KEY, 'true');
              startedAtRef.current = performance.now();
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
          Red/cyan or red/green anaglyph glasses are required for this test. Once you have a
          pair, come back and re-run it.
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
        {noStereopsis ? (
          <>
            <p className="text-sm text-gray-700">
              <strong>No measurable stereopsis detected.</strong>
            </p>
            <p className="text-sm text-gray-600">
              Your responses stayed near chance even at {thresholdArcsec} arc-sec, the largest
              (easiest) disparity this test presents — so a numeric threshold wouldn't be a real
              measurement. This is a real, fairly common finding in strabismic and some other
              forms of amblyopia, not a test failure.
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-700">
            Threshold: <strong>{thresholdArcsec.toFixed(0)} arc-sec</strong>
          </p>
        )}
        <ul className="text-xs text-gray-500">
          {CLINICAL_LINES.map((l) => (
            <li key={l.arcsec}>
              {l.arcsec} arc-sec — {l.label}
            </li>
          ))}
        </ul>
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

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold">Stereoacuity Test</h2>
      <div className="text-xs text-gray-400">
        Trial {trial + 1} (stops automatically between {MIN_TRIALS} and {MAX_TRIALS})
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
