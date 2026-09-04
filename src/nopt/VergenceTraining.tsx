import { useEffect, useRef, useState } from 'react';
import { useProfile } from '../profile/ProfileContext';
import { useSessionLogger } from '../hooks/useSessionLogger';

type SubMode = 'convergence' | 'accommodativeRock' | 'noiseStability';

const SUBMODE_LABELS: Record<SubMode, string> = {
  convergence: 'Convergence push-up',
  accommodativeRock: 'Accommodative rock',
  noiseStability: 'Binocular stability under noise',
};

type LogSessionFn = ReturnType<typeof useSessionLogger>['logSession'];

interface VergenceTrainingProps {
  onComplete?: () => void;
}

export default function VergenceTraining({ onComplete }: VergenceTrainingProps) {
  const { profile } = useProfile();
  const { logSession } = useSessionLogger();
  const [subMode, setSubMode] = useState<SubMode | null>(null);

  if (!subMode) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Vergence + Accommodation Training</h2>
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
      </div>
    );
  }

  if (subMode === 'convergence') {
    return <ConvergencePushup weakEye={profile.weakEye} logSession={logSession} onComplete={onComplete} />;
  }
  if (subMode === 'accommodativeRock') {
    return <AccommodativeRock weakEye={profile.weakEye} logSession={logSession} onComplete={onComplete} />;
  }
  return <NoiseStability weakEye={profile.weakEye} logSession={logSession} onComplete={onComplete} />;
}

// --- Sub-mode A: Convergence push-up -------------------------------------

function ConvergencePushup({
  weakEye,
  logSession,
  onComplete,
}: {
  weakEye: 'left' | 'right';
  logSession: LogSessionFn;
  onComplete?: () => void;
}) {
  const [difficulty, setDifficulty] = useState(20); // 1-100 normalized
  const [done, setDone] = useState(false);
  const startedAtRef = useRef(performance.now());
  const maxSeparationPx = 220;
  const separationPx = maxSeparationPx * (1 - difficulty / 100) + 20;

  function holdFusion() {
    setDifficulty((d) => Math.min(100, d + 5));
  }

  function breakFusion() {
    logSession({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      module: 'nopt',
      exercise: 'VergenceTraining',
      paradigm: 'convergence',
      weakEye,
      durationSeconds: Math.round((performance.now() - startedAtRef.current) / 1000),
      trials: 1,
      staircaseThreshold: difficulty,
      thresholdUnit: 'normalized breakpoint (1-100)',
    });
    setDone(true);
    onComplete?.();
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Session complete</h2>
        <p className="text-sm text-gray-700">Breakpoint: {difficulty} / 100</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold">Convergence push-up</h2>
      <p className="text-sm text-gray-600">
        Look at both circles. If they fuse into one (or you see three), tap "Held" to bring them
        closer. Tap "Broke" the moment fusion breaks.
      </p>
      <svg width={320} height={100} className="mx-auto">
        <circle cx={160 - separationPx / 2} cy={50} r={10} fill="#111111" />
        <circle cx={160 + separationPx / 2} cy={50} r={10} fill="#111111" />
      </svg>
      <div className="text-center text-xs text-gray-400">Difficulty: {difficulty} / 100</div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={holdFusion}
          className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Held
        </button>
        <button
          type="button"
          onClick={breakFusion}
          className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700"
        >
          Broke
        </button>
      </div>
    </div>
  );
}

// --- Sub-mode B: Accommodative rock --------------------------------------

const ROCK_TEXT = 'Focus on this line of text until it looks sharp, then respond.';
const ROCK_DURATION_S = 180;

function AccommodativeRock({
  weakEye,
  logSession,
  onComplete,
}: {
  weakEye: 'left' | 'right';
  logSession: LogSessionFn;
  onComplete?: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [near, setNear] = useState(true);
  const [toggleRts, setToggleRts] = useState<number[]>([]);
  const lastToggleRef = useRef(0);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!running || done) return;
    startedAtRef.current = performance.now();
    lastToggleRef.current = performance.now();
    function onKey(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      const now = performance.now();
      setToggleRts((prev) => [...prev, now - lastToggleRef.current]);
      lastToggleRef.current = now;
      setNear((n) => !n);
      if (now - startedAtRef.current >= ROCK_DURATION_S * 1000) finish();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, done]);

  function finish() {
    setRunning(false);
    setDone(true);
    const meanRt =
      toggleRts.length > 0 ? toggleRts.reduce((s, v) => s + v, 0) / toggleRts.length : undefined;
    logSession({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      module: 'nopt',
      exercise: 'VergenceTraining',
      paradigm: 'accommodativeRock',
      weakEye,
      durationSeconds: Math.round((performance.now() - startedAtRef.current) / 1000),
      trials: toggleRts.length,
      staircaseThreshold: meanRt,
      thresholdUnit: meanRt !== undefined ? 'ms mean toggle RT' : undefined,
    });
    onComplete?.();
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Session complete</h2>
        <p className="text-sm text-gray-700">Toggles: {toggleRts.length}</p>
      </div>
    );
  }

  if (!running) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Accommodative rock</h2>
        <p className="text-sm text-gray-600">
          Text will alternate between near (small) and far (large) size. Press spacebar the
          moment it looks sharp — that switches to the other size. Runs for 3 minutes.
        </p>
        <button
          type="button"
          onClick={() => setRunning(true)}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Start
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-6 p-6" style={{ minHeight: 240 }}>
      <p style={{ fontSize: near ? 12 : 44 }} className="text-center text-gray-800">
        {ROCK_TEXT}
      </p>
      <p className="text-xs text-gray-400">{near ? 'Near' : 'Far'} — press spacebar when clear</p>
    </div>
  );
}

// --- Sub-mode C: Binocular stability under noise --------------------------

const STABILITY_DURATION_S = 45;

function NoiseStability({
  weakEye,
  logSession,
  onComplete,
}: {
  weakEye: 'left' | 'right';
  logSession: LogSessionFn;
  onComplete?: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(STABILITY_DURATION_S);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    if (!running || done) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    startRef.current = performance.now();

    function draw() {
      const t = (performance.now() - startRef.current) / 1000;
      const progress = Math.min(1, t / STABILITY_DURATION_S);
      const density = 0.05 + progress * 0.45; // gradually noisier
      ctx!.fillStyle = '#FFFFFF';
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
      ctx!.fillStyle = '#00000022';
      for (let i = 0; i < 400; i++) {
        if (Math.random() > density) continue;
        const x = Math.random() * canvas!.width;
        const y = Math.random() * canvas!.height;
        ctx!.fillRect(x, y, 2, 2);
      }
      const cx = canvas!.width / 2;
      const cy = canvas!.height / 2;
      ctx!.strokeStyle = '#111111';
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(cx - 8, cy);
      ctx!.lineTo(cx + 8, cy);
      ctx!.moveTo(cx, cy - 8);
      ctx!.lineTo(cx, cy + 8);
      ctx!.stroke();

      if (t >= STABILITY_DURATION_S) {
        finish();
        return;
      }
      setSecondsLeft(Math.ceil(STABILITY_DURATION_S - t));
      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, done]);

  function finish() {
    setRunning(false);
    setDone(true);
    logSession({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      module: 'nopt',
      exercise: 'VergenceTraining',
      paradigm: 'noiseStability',
      weakEye,
      durationSeconds: Math.round((performance.now() - startRef.current) / 1000),
      trials: 1,
    });
    onComplete?.();
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Session complete</h2>
      </div>
    );
  }

  if (!running) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Binocular stability under noise</h2>
        <p className="text-sm text-gray-600">
          Hold your gaze on the central cross while background noise gradually increases.
        </p>
        <button
          type="button"
          onClick={() => setRunning(true)}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Start
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <div className="text-center text-xs text-gray-400">{secondsLeft}s</div>
      <canvas
        ref={canvasRef}
        width={320}
        height={320}
        className="mx-auto rounded border border-gray-200 bg-white"
      />
    </div>
  );
}
