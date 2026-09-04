import { useEffect, useMemo, useRef, useState } from 'react';
import { useProfile } from '../profile/ProfileContext';
import { useViewingCalibration } from '../hooks/useViewingCalibration';
import { useSessionLogger } from '../hooks/useSessionLogger';
import { compositeAnaglyph, drawRDS, type RDSOptions } from '../utils/canvasUtils';
import { channelForEye, type Channel } from '../utils/colorUtils';
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

// Spacing matches clinical circle-test progressions (Randot/Titmus use a
// similar near-halving-then-finer-graduated series, not uniform octaves) —
// each of the original 7 levels doubled in disparity from the next, which
// is a large perceptual jump even one step at a time. Denser spacing near
// the difficult end gives the staircase (see neighborLevels) smaller,
// gentler steps once it's narrowing in, instead of every step feeling like
// a cliff.
const DISPARITY_LEVELS_ARCSEC = [800, 400, 200, 140, 100, 70, 50, 40, 30, 25, 20];
const CANVAS_SIZE = 320;
const TARGET_REGION_RADIUS = 80;
const HAS_GLASSES_KEY = 'has_anaglyph_glasses';

// Fixed dot element size. Scaling this down toward the disparity (the
// Julesz "small element relative to disparity" guideline) was tried and
// made the whole field fainter/harder to read on lower-pixel-density
// displays — legibility of the base noise pattern is the binding
// constraint here, not correspondence ambiguity, so this stays constant
// rather than shrinking on fine trials.
const DOT_RADIUS_PX = 2;

// A disparity that subtends less than this many CSS px can't be trusted as
// a real measurement: below roughly half a pixel, even a faithfully
// dpr-scaled, supersampled render is at the noise floor of what the display
// can represent. This is deliberately NOT tied to dot size — real stereo
// hyperacuity resolves shifts far smaller than a single dot by pooling
// correspondence across the hundreds of dots in the target region, which is
// exactly why clinical RDS tests can measure well below one dot-width on
// ordinary displays; requiring the shift to match a full dot diameter was
// solving a rendering-fidelity problem (now fixed by scaling the canvas
// backing buffer to devicePixelRatio, see the render effect below) with a
// perceptual-floor argument that doesn't actually apply here. Reporting a
// threshold finer than the display can actually render would still be a
// fabricated number, not a measurement — so this level is used to clamp
// which of the disparities above are actually administered on a given
// device, see `testableLevels`.
const MIN_RELIABLE_DISPARITY_PX = 0.5;

// Clinical stereoacuity screening (Randot, Titmus) always presents the
// largest, easiest target first to confirm the participant can perform the
// task at all before narrowing in — the same principle applies here so a
// "no measurable stereopsis" or "test seems broken" impression isn't formed
// before the adaptive procedure has even had a chance to show an
// unambiguous disparity.
const INITIAL_EASY_TRIALS = 2;

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
function tintToChannel(source: HTMLCanvasElement, channel: Channel): HTMLCanvasElement {
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

/**
 * Restricts entropy-maximizing selection to the level adjacent to
 * `currentArcsec` in each direction. Unconstrained, selectNextStereoStimulus
 * can jump straight from the easiest level to one of the hardest after just
 * a couple of correct responses: two correct answers at 800" barely
 * distinguish "threshold near 800"" from "threshold near 20"" under the
 * logistic model (both predict near-certain success at 800"), so the
 * posterior stays broad and the max-entropy candidate can land anywhere in
 * range. Classic adaptive procedures (QUEST and step-limited staircases
 * alike) cap step size for exactly this reason — an abrupt jump to an
 * imperceptible disparity reads as "the test is broken," not as a
 * measurement. Walking one level at a time still uses the Bayesian
 * posterior to decide direction, it just can't skip levels.
 */
function neighborLevels(levels: number[], currentArcsec: number): number[] {
  const idx = levels.indexOf(currentArcsec);
  if (idx === -1) return levels;
  return levels.slice(Math.max(0, idx - 1), Math.min(levels.length, idx + 2));
}

function pickTarget(): Position {
  return POSITIONS[Math.floor(Math.random() * POSITIONS.length)].value;
}

interface StereoTestProps {
  onComplete?: () => void;
}

export default function StereoTest({ onComplete }: StereoTestProps) {
  const { profile } = useProfile();
  const { arcSecToPx, pxToArcSec } = useViewingCalibration();
  const { logStereo, logSession } = useSessionLogger();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedAtRef = useRef(performance.now());

  // Which of the fixed disparity levels this device/calibration can
  // actually render reliably (see MIN_RELIABLE_DISPARITY_PX). Uncalibrated
  // (ppmm=0) makes pxToArcSec return Infinity, so every level is excluded —
  // correctly refusing to test rather than silently presenting disparities
  // with no known physical size.
  const minReliableArcsec = pxToArcSec(MIN_RELIABLE_DISPARITY_PX);
  const testableLevels = useMemo(
    () => DISPARITY_LEVELS_ARCSEC.filter((arcsec) => arcsec >= minReliableArcsec),
    [minReliableArcsec],
  );
  const canAdminister = testableLevels.length >= 2;

  const [hasGlasses, setHasGlasses] = useState<boolean | null>(() => {
    const stored = localStorage.getItem(HAS_GLASSES_KEY);
    return stored === null ? null : stored === 'true';
  });

  const [posterior, setPosterior] = useState<StereoPosterior>(() => initStereoPosterior());
  const [currentArcsec, setCurrentArcsec] = useState<number>(() =>
    canAdminister ? testableLevels[0] : DISPARITY_LEVELS_ARCSEC[0],
  );
  const [target, setTarget] = useState<Position>(pickTarget);
  const [trial, setTrial] = useState(0);
  const [done, setDone] = useState(false);
  const [thresholdArcsec, setThresholdArcsec] = useState<number | null>(null);
  const [noStereopsis, setNoStereopsis] = useState(false);

  useEffect(() => {
    if (hasGlasses !== true || done || !canAdminister) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // The canvas backing buffer must be scaled by the real device pixel
    // ratio, not left at CANVAS_SIZE flat: otherwise the browser stretches a
    // low-res buffer to fill a HiDPI screen's larger physical pixel area,
    // discarding the fine sub-pixel gradients drawRDS's supersampling was
    // built to preserve before they ever reach the display. CSS size stays
    // fixed at CANVAS_SIZE (see the style prop) so the on-page layout is
    // unaffected — only the drawing resolution goes up.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const disparityPx = arcSecToPx(currentArcsec) * dpr;
    const seed = trial + 1;

    const left = document.createElement('canvas');
    left.width = CANVAS_SIZE * dpr;
    left.height = CANVAS_SIZE * dpr;
    drawRDS(left.getContext('2d')!, {
      disparityPx,
      targetRegionRadius: TARGET_REGION_RADIUS * dpr,
      targetPosition: target,
      eye: 'left',
      seed,
      dotRadiusPx: DOT_RADIUS_PX * dpr,
    });

    const right = document.createElement('canvas');
    right.width = CANVAS_SIZE * dpr;
    right.height = CANVAS_SIZE * dpr;
    drawRDS(right.getContext('2d')!, {
      disparityPx,
      targetRegionRadius: TARGET_REGION_RADIUS * dpr,
      targetPosition: target,
      eye: 'right',
      seed,
      dotRadiusPx: DOT_RADIUS_PX * dpr,
    });

    // The RDS 'left'/'right' halves stand for what each anatomical eye
    // should see; which physical channel (red vs. the other anaglyph
    // color) belongs to which eye depends on the profile's weak eye and
    // glasses — not a fixed "left is always red" assumption, matching the
    // rest of the dichoptic exercises (colorUtils.channelForEye).
    compositeAnaglyph(
      tintToChannel(left, channelForEye(profile, 'left')),
      tintToChannel(right, channelForEye(profile, 'right')),
      ctx,
    );
  }, [
    hasGlasses,
    done,
    canAdminister,
    currentArcsec,
    target,
    trial,
    arcSecToPx,
    profile.lensType,
    profile.weakEyeChannel,
    profile.weakEye,
  ]);

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
    const pNoStereopsis = probabilityNoStereopsis(nextPosterior, testableLevels[0]);
    const converged = entropy <= ENTROPY_STOP_BITS || pNoStereopsis >= NO_STEREOPSIS_PROBABILITY;
    const shouldStop = nextTrial >= MAX_TRIALS || (nextTrial >= MIN_TRIALS && converged);

    if (shouldStop) {
      const isNoStereopsis = pNoStereopsis >= NO_STEREOPSIS_PROBABILITY;
      const smallestTested = testableLevels[testableLevels.length - 1];
      const largestTested = testableLevels[0];
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
    setCurrentArcsec(
      nextTrial < INITIAL_EASY_TRIALS
        ? testableLevels[0]
        : selectNextStereoStimulus(nextPosterior, neighborLevels(testableLevels, currentArcsec)),
    );
    setTarget(pickTarget());
  }

  if (!canAdminister) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Stereoacuity Test — can't be run yet</h2>
        <p className="text-sm text-gray-600">
          {Number.isFinite(minReliableArcsec) ? (
            <>
              At your current calibration, disparities finer than{' '}
              <strong>{minReliableArcsec.toFixed(0)} arc-sec</strong> can't be rendered as more
              than a fraction of a screen pixel — too small to trust as a real depth cue. That
              leaves too few of this test's levels to measure a threshold, so reporting a number
              anyway would be a guess dressed up as a measurement, not a real result.
            </>
          ) : (
            <>
              No viewing-distance calibration is on record, so pixel disparities can't be
              converted to a physical visual angle at all.
            </>
          )}
        </p>
        <p className="text-sm text-gray-600">
          Run (or re-run) calibration under Settings, ideally on a smaller, higher-resolution
          display if you have one — that raises how fine a disparity this test can validly
          measure.
        </p>
      </div>
    );
  }

  if (hasGlasses === null) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Stereoacuity Test</h2>
        <p className="text-sm text-gray-600">
          This test requires red/cyan or red/green anaglyph glasses to view the depth stimulus.
          Set which kind you have under Settings → Lens type.
        </p>
        {testableLevels.length < DISPARITY_LEVELS_ARCSEC.length && (
          <p className="text-xs text-gray-500">
            Your display can validly measure stereoacuity down to about{' '}
            <strong>{testableLevels[testableLevels.length - 1]} arc-sec</strong> — finer than
            that isn't distinguishable from a guess on this device.
          </p>
        )}
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
        {testableLevels.length < DISPARITY_LEVELS_ARCSEC.length && (
          <p className="text-xs text-gray-500">
            Measurement floor for your display: this test could only validly distinguish
            thresholds down to <strong>{testableLevels[testableLevels.length - 1]} arc-sec</strong>
            {' '}— it can't tell a finer real threshold from a guess on this device, so treat any
            result at that floor as "at least this good," not exact.
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
        style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
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
