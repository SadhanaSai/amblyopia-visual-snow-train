import { useEffect, useRef, useState } from 'react';
import { useProfile } from '../profile/ProfileContext';
import { useSessionLogger } from '../hooks/useSessionLogger';

type SubMode = 'blueField' | 'floater' | 'photopsia';

const SUBMODE_LABELS: Record<SubMode, string> = {
  blueField: 'Blue-field phosphene habituation',
  floater: 'Floater desensitization',
  photopsia: 'Photopsia desensitization',
};

type LogSessionFn = ReturnType<typeof useSessionLogger>['logSession'];

interface EntopticDesensitizationProps {
  onComplete?: () => void;
}

export default function EntopticDesensitization({ onComplete }: EntopticDesensitizationProps) {
  const { profile } = useProfile();
  const { logSession } = useSessionLogger();
  const [subMode, setSubMode] = useState<SubMode | null>(null);

  if (!subMode) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Entoptic Desensitization</h2>
        <div className="flex flex-col gap-2">
          {(Object.keys(SUBMODE_LABELS) as SubMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSubMode(m)}
              disabled={m === 'photopsia' && profile.photosensitiveEpilepsy}
              className="rounded-lg border border-gray-200 p-3 text-left text-sm font-medium disabled:opacity-40"
            >
              {SUBMODE_LABELS[m]}
              {m === 'photopsia' && profile.photosensitiveEpilepsy && (
                <span className="ml-2 text-xs text-amber-600">Locked</span>
              )}
            </button>
          ))}
        </div>
        {profile.photosensitiveEpilepsy && (
          <p className="text-xs text-gray-400">
            This exercise is not available due to your photosensitivity profile. All other
            modules remain accessible.
          </p>
        )}
      </div>
    );
  }

  if (subMode === 'blueField') {
    return <BlueField weakEye={profile.weakEye} logSession={logSession} onComplete={onComplete} />;
  }
  if (subMode === 'floater') {
    return <FloaterDesensitization weakEye={profile.weakEye} logSession={logSession} onComplete={onComplete} />;
  }
  return <Photopsia weakEye={profile.weakEye} logSession={logSession} onComplete={onComplete} />;
}

// --- Sub-mode A: Blue-field phosphene habituation --------------------------

const BLUE_FIELD_KEY = 'blue_field_duration_s';
const BLUE_FIELD_START_S = 30;
const BLUE_FIELD_MAX_S = 180;
const BLUE_FIELD_STEP_S = 30;

function BlueField({
  weakEye,
  logSession,
  onComplete,
}: {
  weakEye: 'left' | 'right';
  logSession: LogSessionFn;
  onComplete?: () => void;
}) {
  const [phase, setPhase] = useState<'pre' | 'running' | 'post' | 'done'>('pre');
  const [preRating, setPreRating] = useState(5);
  const [postRating, setPostRating] = useState(5);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const startedAtRef = useRef(performance.now());

  const durationS = Math.min(
    BLUE_FIELD_MAX_S,
    Number(localStorage.getItem(BLUE_FIELD_KEY)) || BLUE_FIELD_START_S,
  );

  useEffect(() => {
    if (phase !== 'running') return;
    setSecondsLeft(durationS);
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          setPhase('post');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, durationS]);

  function finish() {
    const nextDuration = Math.min(BLUE_FIELD_MAX_S, durationS + BLUE_FIELD_STEP_S);
    localStorage.setItem(BLUE_FIELD_KEY, String(nextDuration));
    logSession({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      module: 'nopt',
      exercise: 'EntopticDesensitization',
      paradigm: 'blueField',
      weakEye,
      durationSeconds: Math.round((performance.now() - startedAtRef.current) / 1000),
      trials: 1,
      selfRating: { pre: preRating, post: postRating },
    });
    setPhase('done');
    onComplete?.();
  }

  if (phase === 'pre') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Blue-field phosphene habituation</h2>
        <p className="text-sm text-gray-600">Rate how intrusive floating specks feel right now.</p>
        <RatingSlider value={preRating} onChange={setPreRating} />
        <button
          type="button"
          onClick={() => {
            startedAtRef.current = performance.now();
            setPhase('running');
          }}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Start ({durationS}s)
        </button>
      </div>
    );
  }

  if (phase === 'running') {
    return (
      <div
        className="flex min-h-[60vh] flex-col items-center justify-center gap-4"
        style={{ backgroundColor: '#AACFE4' }}
      >
        <div className="text-lg font-medium text-gray-700">{secondsLeft}s</div>
      </div>
    );
  }

  if (phase === 'post') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">How intrusive now?</h2>
        <RatingSlider value={postRating} onChange={setPostRating} />
        <button
          type="button"
          onClick={finish}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Submit
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold">Session complete</h2>
      <p className="text-sm text-gray-700">
        Next session will run {Math.min(BLUE_FIELD_MAX_S, durationS + BLUE_FIELD_STEP_S)}s.
      </p>
    </div>
  );
}

// --- Sub-mode B: Floater desensitization ----------------------------------

const FLOATER_CONTRAST_KEY = 'floater_overlay_contrast_pct';
const FLOATER_START_PCT = 30;
const FLOATER_MIN_PCT = 5;
const FLOATER_STEP_PCT = 5;
const FLOATER_DURATION_S = 120;

function FloaterDesensitization({
  weakEye,
  logSession,
  onComplete,
}: {
  weakEye: 'left' | 'right';
  logSession: LogSessionFn;
  onComplete?: () => void;
}) {
  const [phase, setPhase] = useState<'setup' | 'running' | 'rating' | 'done'>('setup');
  const [angle, setAngle] = useState(0);
  const [rating, setRating] = useState(5);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(performance.now());

  const contrastPct = Math.min(
    FLOATER_START_PCT,
    Number(localStorage.getItem(FLOATER_CONTRAST_KEY)) || FLOATER_START_PCT,
  );

  useEffect(() => {
    if (phase !== 'running') return;
    const start = performance.now();
    startedAtRef.current = start;
    function tick(now: number) {
      setAngle(((now - start) / 1000) * 60);
      if (now - start >= FLOATER_DURATION_S * 1000) {
        setPhase('rating');
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [phase]);

  function submitRating(value: number) {
    setRating(value);
    // Lower rating = less intrusive = improvement -> drop overlay contrast further next time.
    const nextContrast =
      value <= 4 ? Math.max(FLOATER_MIN_PCT, contrastPct - FLOATER_STEP_PCT) : contrastPct;
    localStorage.setItem(FLOATER_CONTRAST_KEY, String(nextContrast));
    logSession({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      module: 'nopt',
      exercise: 'EntopticDesensitization',
      paradigm: 'floater',
      weakEye,
      durationSeconds: Math.round((performance.now() - startedAtRef.current) / 1000),
      trials: 1,
      selfRating: { pre: 0, post: value },
      notes: `overlayContrastPct=${contrastPct}`,
    });
    setPhase('done');
    onComplete?.();
  }

  if (phase === 'setup') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Floater desensitization</h2>
        <p className="text-sm text-gray-600">
          Watch the moving shape behind the translucent overlay for 2 minutes.
        </p>
        <button
          type="button"
          onClick={() => setPhase('running')}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Start
        </button>
      </div>
    );
  }

  if (phase === 'running') {
    const cx = 160 + 80 * Math.cos((angle * Math.PI) / 180);
    const cy = 160 + 80 * Math.sin((angle * Math.PI) / 180);
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
        <div className="relative mx-auto" style={{ width: 320, height: 320 }}>
          <svg width={320} height={320} className="absolute inset-0 bg-white">
            <circle cx={cx} cy={cy} r={14} fill="#111111" />
          </svg>
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `rgba(120,120,120,${contrastPct / 100})`,
              margin: 60,
            }}
          />
        </div>
      </div>
    );
  }

  if (phase === 'rating') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">How intrusive were the floaters?</h2>
        <RatingSlider value={rating} onChange={setRating} />
        <button
          type="button"
          onClick={() => submitRating(rating)}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Submit
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold">Session complete</h2>
    </div>
  );
}

// --- Sub-mode C: Photopsia desensitization ---------------------------------

const PHOTOPSIA_TRIALS = 10;
const FLASH_MS = 10;
const ISI_MS = 2000;

function Photopsia({
  weakEye,
  logSession,
  onComplete,
}: {
  weakEye: 'left' | 'right';
  logSession: LogSessionFn;
  onComplete?: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [trial, setTrial] = useState(0);
  const [ratings, setRatings] = useState<number[]>([]);
  const [awaitingRating, setAwaitingRating] = useState(false);
  const [rating, setRating] = useState(5);
  const [done, setDone] = useState(false);
  const startedAtRef = useRef(performance.now());

  useEffect(() => {
    if (!running || awaitingRating || done) return;
    const flashTimeout = window.setTimeout(() => {
      setFlashing(true);
      window.setTimeout(() => {
        setFlashing(false);
        setAwaitingRating(true);
      }, FLASH_MS);
    }, ISI_MS);
    return () => window.clearTimeout(flashTimeout);
  }, [running, awaitingRating, done, trial]);

  function submitRating() {
    const nextRatings = [...ratings, rating];
    setRatings(nextRatings);
    setAwaitingRating(false);
    const nextTrial = trial + 1;
    setTrial(nextTrial);
    if (nextTrial >= PHOTOPSIA_TRIALS) {
      finish(nextRatings);
    }
  }

  function finish(finalRatings: number[]) {
    const meanRating = finalRatings.reduce((s, v) => s + v, 0) / Math.max(1, finalRatings.length);
    logSession({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      module: 'nopt',
      exercise: 'EntopticDesensitization',
      paradigm: 'photopsia',
      weakEye,
      durationSeconds: Math.round((performance.now() - startedAtRef.current) / 1000),
      trials: finalRatings.length,
      selfRating: { pre: 0, post: meanRating },
    });
    setRunning(false);
    setDone(true);
    onComplete?.();
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Session complete</h2>
        <p className="text-sm text-gray-700">
          Mean intrusiveness: {(ratings.reduce((s, v) => s + v, 0) / Math.max(1, ratings.length)).toFixed(1)} / 10
        </p>
      </div>
    );
  }

  if (!running) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Photopsia desensitization</h2>
        <p className="text-sm text-gray-600">
          Low-intensity white pulses will flash briefly, {PHOTOPSIA_TRIALS} times. Rate each one.
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

  if (awaitingRating) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">How intrusive was that flash?</h2>
        <RatingSlider value={rating} onChange={setRating} />
        <button
          type="button"
          onClick={submitRating}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Next
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-gray-900"
      style={{ backgroundColor: flashing ? '#EEEEEE' : '#111111' }}
    >
      <div className="text-xs text-gray-400">
        Trial {trial + 1} / {PHOTOPSIA_TRIALS}
      </div>
    </div>
  );
}

function RatingSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <input
        type="range"
        min={0}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="text-center text-sm text-gray-500">{value} / 10</div>
    </div>
  );
}
