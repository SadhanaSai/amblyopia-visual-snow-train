import { useEffect, useRef, useState } from 'react';
import { useProfile } from '../profile/ProfileContext';
import { useViewingCalibration } from '../hooks/useViewingCalibration';
import { useSessionLogger } from '../hooks/useSessionLogger';
import { useResponsiveWidth } from '../hooks/useResponsiveWidth';

type SubMode = 'targeting' | 'pursuit' | 'antisaccade';

const SUBMODE_LABELS: Record<SubMode, string> = {
  targeting: 'Saccadic targeting',
  pursuit: 'Smooth pursuit',
  antisaccade: 'Anti-saccade (advanced)',
};

const DURATIONS_MIN = [12, 24] as const;
const ECCENTRICITIES = [10, 15, 20] as const;
const PURSUIT_SPEEDS = [10, 20, 30] as const;
const CANVAS_SIZE = 320;
const RT_ESCALATION_MS = 250;
const RT_ESCALATION_WINDOW = 5;
const ANTISACCADE_FLASH_MS = 150;
const ANTISACCADE_RESPONSE_MS = 500;
const PURSUIT_RUN_S = 60;
const PURSUIT_AMPLITUDE_DEG = 15;

// Target radius + a small clearance so the circle never touches the field's
// edge — used to decide whether a given real-world offset actually fits
// inside the measured stimulus field before it's drawn.
const TARGET_CLEARANCE_PX = 20;

/** Largest offset (in real calibrated CSS px) that still fits inside a field of this width. */
function maxOffsetForWidth(fieldWidth: number): number {
  return Math.max(0, fieldWidth / 2 - TARGET_CLEARANCE_PX);
}

interface SaccadicTrainingProps {
  onComplete?: () => void;
}

export default function SaccadicTraining({ onComplete }: SaccadicTrainingProps) {
  const { profile } = useProfile();
  const { degToPx, pxToArcSec } = useViewingCalibration();
  const { logSession } = useSessionLogger();

  const [subMode, setSubMode] = useState<SubMode | null>(null);
  const [durationMin, setDurationMin] = useState<(typeof DURATIONS_MIN)[number]>(12);

  if (!subMode) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Saccadic Training</h2>
        <div className="flex flex-col gap-2">
          {(Object.keys(SUBMODE_LABELS) as SubMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSubMode(m)}
              className="rounded-lg border border-gray-200 p-3 text-left text-sm font-medium"
            >
              {SUBMODE_LABELS[m]}
            </button>
          ))}
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-gray-500">Session length</div>
          <div className="flex gap-2">
            {DURATIONS_MIN.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDurationMin(d)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  durationMin === d ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
                }`}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (subMode === 'targeting') {
    return (
      <Targeting
        weakEye={profile.weakEye}
        durationSec={durationMin * 60}
        degToPx={degToPx}
        pxToArcSec={pxToArcSec}
        logSession={logSession}
        onComplete={onComplete}
      />
    );
  }

  if (subMode === 'pursuit') {
    return (
      <Pursuit
        weakEye={profile.weakEye}
        durationSec={durationMin * 60}
        degToPx={degToPx}
        logSession={logSession}
        onComplete={onComplete}
      />
    );
  }

  return (
    <Antisaccade
      weakEye={profile.weakEye}
      durationSec={durationMin * 60}
      logSession={logSession}
      onComplete={onComplete}
    />
  );
}

type LogSessionFn = ReturnType<typeof useSessionLogger>['logSession'];

// --- Sub-mode A: Saccadic targeting ----------------------------------

function Targeting({
  weakEye,
  durationSec,
  degToPx,
  pxToArcSec,
  logSession,
  onComplete,
}: {
  weakEye: 'left' | 'right';
  durationSec: number;
  degToPx: (deg: number) => number;
  pxToArcSec: (px: number) => number;
  logSession: LogSessionFn;
  onComplete?: () => void;
}) {
  const { containerRef, width: fieldWidth } = useResponsiveWidth(CANVAS_SIZE);
  const maxOffsetPx = maxOffsetForWidth(fieldWidth);
  // Prefer the standard clinical eccentricities, but every real screen is a
  // different physical size at a different calibration — a laptop in a
  // half-width window can easily be narrower than what 10° of real visual
  // angle needs. Rather than refusing to run at all on such a display (which
  // fails the "works on all displays" requirement), fall back to the largest
  // eccentricity this specific screen can actually show, honestly labeled
  // with its real (possibly non-standard) degree value instead of a claimed
  // 10/15/20 that wouldn't match what's drawn.
  const fittingEccentricities = ECCENTRICITIES.filter((e) => degToPx(e) <= maxOffsetPx);
  const maxFittingDeg = Math.floor((pxToArcSec(maxOffsetPx) / 3600) * 10) / 10;
  const availableEccentricities: number[] =
    fittingEccentricities.length > 0
      ? fittingEccentricities
      : maxFittingDeg > 0
        ? [maxFittingDeg]
        : [];

  const [eccentricity, setEccentricity] = useState<number>(10);
  const [side, setSide] = useState<'left' | 'right'>('left');
  const [trialStart, setTrialStart] = useState<number | null>(null);
  const [rts, setRts] = useState<number[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!running || done) return;
    setTrialStart(performance.now());
  }, [running, done, side]);

  useEffect(() => {
    if (!running || done) return;
    function onKey(e: KeyboardEvent) {
      if (e.code !== 'Space' || trialStart === null) return;
      const rt = performance.now() - trialStart;
      const nextRts = [...rts, rt];
      setRts(nextRts);

      const tail = nextRts.slice(-RT_ESCALATION_WINDOW);
      if (
        tail.length === RT_ESCALATION_WINDOW &&
        tail.reduce((s, v) => s + v, 0) / tail.length < RT_ESCALATION_MS
      ) {
        setEccentricity((e) => {
          const idx = availableEccentricities.indexOf(e);
          if (idx === -1) return e;
          return availableEccentricities[Math.min(idx + 1, availableEccentricities.length - 1)];
        });
      }

      if (performance.now() - startedAtRef.current >= durationSec * 1000) {
        finish(nextRts);
      } else {
        setSide((s) => (s === 'left' ? 'right' : 'left'));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, done, trialStart, rts]);

  function finish(finalRts: number[]) {
    const meanRt = finalRts.reduce((s, v) => s + v, 0) / Math.max(1, finalRts.length);
    logSession({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      module: 'nopt',
      exercise: 'SaccadicTraining',
      paradigm: 'targeting',
      weakEye,
      durationSeconds: Math.round((performance.now() - startedAtRef.current) / 1000),
      trials: finalRts.length,
      staircaseThreshold: meanRt,
      thresholdUnit: 'ms mean RT',
      notes: `finalEccentricity=${eccentricity}deg`,
    });
    setRunning(false);
    setDone(true);
    onComplete?.();
  }

  const cx = fieldWidth / 2;
  // Clamped as a last-resort safety net — fittingEccentricities and the
  // escalation cap below should already keep `eccentricity` displayable, but
  // a mid-session window resize could shrink the field out from under it.
  const offsetPx = Math.min(degToPx(eccentricity), maxOffsetPx);

  if (done) {
    const meanRt = rts.reduce((s, v) => s + v, 0) / Math.max(1, rts.length);
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Session complete</h2>
        <p className="text-sm text-gray-700">Mean RT: {meanRt.toFixed(0)}ms</p>
        <p className="text-sm text-gray-700">Final eccentricity: {eccentricity}°</p>
      </div>
    );
  }

  if (!running) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Saccadic targeting</h2>
        {/* Full-width, uncapped (not the narrower max-w-2xl used for text
            elsewhere) and mounted here as well as in the running view, so its
            real width is already measured before Start is pressed. */}
        <div ref={containerRef} className="h-0 w-full" aria-hidden />
        {availableEccentricities.length === 0 ? (
          <p className="text-sm text-amber-700">
            This window is too narrow to run this exercise at all. Widen it and try again.
          </p>
        ) : (
          <div>
            <div className="mb-1 text-xs font-medium text-gray-500">
              Starting eccentricity
              {fittingEccentricities.length === 0 && (
                <span className="ml-1 text-amber-600">
                  (reduced from the standard 10-20° — this window isn't wide enough for those)
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {availableEccentricities.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEccentricity(e)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    eccentricity === e ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
                  }`}
                >
                  {e}°
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          type="button"
          disabled={availableEccentricities.length === 0}
          onClick={() => {
            if (!availableEccentricities.includes(eccentricity)) {
              setEccentricity(availableEccentricities[0]);
            }
            startedAtRef.current = performance.now();
            setRunning(true);
          }}
          className="self-start rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Start
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <p className="text-center text-xs text-gray-500">
        Fixate the target, then press spacebar as soon as you see it — it will jump to the other
        side.
      </p>
      {/* viewBox matches the field's real measured width 1:1 so degToPx's
          calibrated CSS-px offset lands at its true physical position instead
          of being rescaled by an unrelated abstract coordinate space. */}
      <div ref={containerRef} className="w-full">
        <svg viewBox={`0 0 ${fieldWidth} 120`} className="h-auto w-full">
          <circle
            cx={side === 'left' ? cx - offsetPx : cx + offsetPx}
            cy={60}
            r={8}
            fill="#111111"
          />
        </svg>
      </div>
      <div className="text-center text-xs text-gray-400">Eccentricity: {eccentricity}°</div>
    </div>
  );
}

// --- Sub-mode B: Smooth pursuit ----------------------------------------

function Pursuit({
  weakEye,
  durationSec,
  degToPx,
  logSession,
  onComplete,
}: {
  weakEye: 'left' | 'right';
  durationSec: number;
  degToPx: (deg: number) => number;
  logSession: LogSessionFn;
  onComplete?: () => void;
}) {
  const { containerRef, width: fieldWidth } = useResponsiveWidth(CANVAS_SIZE);
  // Unlike Targeting's fixed eccentricities (a clinical threshold, so an
  // unfitting one is withheld rather than shown at the wrong size), Pursuit's
  // 15° amplitude isn't itself the measurement — clamping it to what the
  // field can actually display keeps the exercise usable on a narrow window
  // instead of the target moving off-screen and disappearing.
  const maxOffsetPx = maxOffsetForWidth(fieldWidth);
  const [speed, setSpeed] = useState<(typeof PURSUIT_SPEEDS)[number]>(20);
  const [phase, setPhase] = useState<'setup' | 'running' | 'rating' | 'done'>('setup');
  const [x, setX] = useState(fieldWidth / 2);
  const [elapsedTotal, setElapsedTotal] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    if (phase !== 'running') return;
    startRef.current = performance.now();
    const amplitudePx = Math.min(degToPx(PURSUIT_AMPLITUDE_DEG), maxOffsetPx);
    const omega = speed / PURSUIT_AMPLITUDE_DEG; // rad/s
    const centerX = fieldWidth / 2;

    function tick(now: number) {
      const t = (now - startRef.current) / 1000;
      setX(centerX + amplitudePx * Math.sin(omega * t));
      if (t >= PURSUIT_RUN_S) {
        setPhase('rating');
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, speed, degToPx, fieldWidth, maxOffsetPx]);

  function submitRating(rating: number) {
    logSession({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      module: 'nopt',
      exercise: 'SaccadicTraining',
      paradigm: 'pursuit',
      weakEye,
      durationSeconds: Math.round((performance.now() - startRef.current) / 1000),
      trials: 1,
      selfRating: { pre: 0, post: rating },
      notes: `speed=${speed}deg/s`,
    });
    const nextElapsed = elapsedTotal + PURSUIT_RUN_S;
    setElapsedTotal(nextElapsed);
    if (nextElapsed >= durationSec) {
      setPhase('done');
      onComplete?.();
    } else {
      setPhase('running');
    }
  }

  if (phase === 'setup') {
    return (
      <div className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Smooth pursuit</h2>
        {/* Mounted here (not just in the running view) so its real width is
            already measured before Start is pressed. */}
        <div ref={containerRef} className="h-0 w-full" aria-hidden />
        <div className="flex gap-2">
          {PURSUIT_SPEEDS.map((s) => (
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
        <button
          type="button"
          onClick={() => setPhase('running')}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Start (60s run)
        </button>
      </div>
    );
  }

  if (phase === 'rating') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Rate your tracking smoothness</h2>
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
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Session complete</h2>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <p className="text-center text-xs text-gray-500">Follow the target smoothly with your eyes.</p>
      <div ref={containerRef} className="w-full">
        <svg viewBox={`0 0 ${fieldWidth} 120`} className="h-auto w-full">
          <circle cx={x} cy={60} r={8} fill="#111111" />
        </svg>
      </div>
    </div>
  );
}

// --- Sub-mode C: Anti-saccade -------------------------------------------
// Keyboard-based proxy for saccade direction (opposite-side arrow key press
// within the response window) — true gaze direction requires an infrared
// eye tracker, which this app doesn't have (see spec's NOT_IMPLEMENTED list).

function Antisaccade({
  weakEye,
  durationSec,
  logSession,
  onComplete,
}: {
  weakEye: 'left' | 'right';
  durationSec: number;
  logSession: LogSessionFn;
  onComplete?: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [flashSide, setFlashSide] = useState<'left' | 'right' | null>(null);
  const [trials, setTrials] = useState(0);
  const [errors, setErrors] = useState(0);
  const [rts, setRts] = useState<number[]>([]);
  const startedAtRef = useRef(0);
  const trialStartRef = useRef(0);
  const respondedRef = useRef(false);

  useEffect(() => {
    if (!running || done) return;
    let cancelled = false;
    let flashTimeout: number | undefined;
    let hideTimeout: number | undefined;
    let windowTimeout: number | undefined;

    function nextTrial() {
      if (cancelled) return;
      if (performance.now() - startedAtRef.current >= durationSec * 1000) {
        finish();
        return;
      }
      flashTimeout = window.setTimeout(() => {
        const side = Math.random() < 0.5 ? 'left' : 'right';
        setFlashSide(side);
        respondedRef.current = false;
        trialStartRef.current = performance.now();
        setTrials((t) => t + 1);

        hideTimeout = window.setTimeout(() => setFlashSide(null), ANTISACCADE_FLASH_MS);
        windowTimeout = window.setTimeout(() => {
          if (!respondedRef.current) setErrors((e) => e + 1);
          nextTrial();
        }, ANTISACCADE_RESPONSE_MS);
      }, 800 + Math.random() * 1200);
    }

    nextTrial();
    return () => {
      cancelled = true;
      if (flashTimeout !== undefined) window.clearTimeout(flashTimeout);
      if (hideTimeout !== undefined) window.clearTimeout(hideTimeout);
      if (windowTimeout !== undefined) window.clearTimeout(windowTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, done]);

  useEffect(() => {
    if (!running || done) return;
    function onKey(e: KeyboardEvent) {
      if (flashSide === null || respondedRef.current) return;
      const pressedOpposite =
        (e.key === 'ArrowLeft' && flashSide === 'right') ||
        (e.key === 'ArrowRight' && flashSide === 'left');
      const pressedSame = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      if (!pressedSame) return;
      respondedRef.current = true;
      const rt = performance.now() - trialStartRef.current;
      if (pressedOpposite) {
        setRts((prev) => [...prev, rt]);
      } else {
        setErrors((e2) => e2 + 1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, done, flashSide]);

  function finish() {
    setRunning(false);
    setDone(true);
    const meanRt = rts.length > 0 ? rts.reduce((s, v) => s + v, 0) / rts.length : undefined;
    logSession({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      module: 'nopt',
      exercise: 'SaccadicTraining',
      paradigm: 'antisaccade',
      weakEye,
      durationSeconds: Math.round((performance.now() - startedAtRef.current) / 1000),
      trials,
      accuracy: trials > 0 ? 1 - errors / trials : undefined,
      staircaseThreshold: meanRt,
      thresholdUnit: meanRt !== undefined ? 'ms mean correct RT' : undefined,
      notes: `errors=${errors} rtDistribution=${JSON.stringify(rts)}`,
    });
    onComplete?.();
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Session complete</h2>
        <p className="text-sm text-gray-700">
          Error rate: {trials > 0 ? ((errors / trials) * 100).toFixed(0) : 0}%
        </p>
      </div>
    );
  }

  if (!running) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Anti-saccade</h2>
        <p className="text-sm text-gray-600">
          A target will flash on one side. Press the arrow key for the <strong>opposite</strong>{' '}
          side as quickly as you can.
        </p>
        <button
          type="button"
          onClick={() => {
            startedAtRef.current = performance.now();
            setRunning(true);
          }}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Start
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Trial {trials}</span>
        {trials > 0 && <span>{Math.round((1 - errors / trials) * 100)}% correct</span>}
      </div>
      <svg viewBox={`0 0 ${CANVAS_SIZE} 120`} className="mx-auto h-auto w-full max-w-2xl">
        {flashSide && (
          <circle cx={flashSide === 'left' ? 60 : CANVAS_SIZE - 60} cy={60} r={10} fill="#111111" />
        )}
      </svg>
    </div>
  );
}
