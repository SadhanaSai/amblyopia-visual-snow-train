import { useEffect, useRef, useState } from 'react';
import { useProfile } from '../profile/ProfileContext';
import { useViewingCalibration } from '../hooks/useViewingCalibration';
import { useSessionLogger } from '../hooks/useSessionLogger';

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

interface SaccadicTrainingProps {
  onComplete?: () => void;
}

export default function SaccadicTraining({ onComplete }: SaccadicTrainingProps) {
  const { profile } = useProfile();
  const { degToPx } = useViewingCalibration();
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
  logSession,
  onComplete,
}: {
  weakEye: 'left' | 'right';
  durationSec: number;
  degToPx: (deg: number) => number;
  logSession: LogSessionFn;
  onComplete?: () => void;
}) {
  const [eccentricity, setEccentricity] = useState<(typeof ECCENTRICITIES)[number]>(10);
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
        setEccentricity((e) => (ECCENTRICITIES[Math.min(ECCENTRICITIES.indexOf(e) + 1, 2)]));
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

  const cx = CANVAS_SIZE / 2;
  const offsetPx = degToPx(eccentricity);

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
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Saccadic targeting</h2>
        <div>
          <div className="mb-1 text-xs font-medium text-gray-500">Starting eccentricity</div>
          <div className="flex gap-2">
            {ECCENTRICITIES.map((e) => (
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
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <p className="text-center text-xs text-gray-500">
        Fixate the target, then press spacebar as soon as you see it — it will jump to the other
        side.
      </p>
      <svg width={CANVAS_SIZE} height={120} className="mx-auto">
        <circle
          cx={side === 'left' ? cx - offsetPx : cx + offsetPx}
          cy={60}
          r={8}
          fill="#111111"
        />
      </svg>
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
  const [speed, setSpeed] = useState<(typeof PURSUIT_SPEEDS)[number]>(20);
  const [phase, setPhase] = useState<'setup' | 'running' | 'rating' | 'done'>('setup');
  const [x, setX] = useState(CANVAS_SIZE / 2);
  const [elapsedTotal, setElapsedTotal] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    if (phase !== 'running') return;
    startRef.current = performance.now();
    const amplitudePx = degToPx(PURSUIT_AMPLITUDE_DEG);
    const omega = speed / PURSUIT_AMPLITUDE_DEG; // rad/s

    function tick(now: number) {
      const t = (now - startRef.current) / 1000;
      setX(CANVAS_SIZE / 2 + amplitudePx * Math.sin(omega * t));
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
  }, [phase, speed, degToPx]);

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
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Smooth pursuit</h2>
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
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <p className="text-center text-xs text-gray-500">Follow the target smoothly with your eyes.</p>
      <svg width={CANVAS_SIZE} height={120} className="mx-auto">
        <circle cx={x} cy={60} r={8} fill="#111111" />
      </svg>
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
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <div className="text-xs text-gray-400">Trial {trials}</div>
      <svg width={CANVAS_SIZE} height={120} className="mx-auto">
        {flashSide && (
          <circle cx={flashSide === 'left' ? 60 : CANVAS_SIZE - 60} cy={60} r={10} fill="#111111" />
        )}
      </svg>
    </div>
  );
}
