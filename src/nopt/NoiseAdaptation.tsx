import { useEffect, useRef, useState } from 'react';
import { useProfile } from '../profile/ProfileContext';
import { useSessionLogger } from '../hooks/useSessionLogger';

const DURATIONS = [5, 15, 45, 135] as const;
const MAX_ROUNDS = 3;
const REST_SECONDS = 180;
// Full native-resolution per-pixel noise at 60fps is prohibitively expensive
// on a large viewport; render at a fixed coarse resolution and scale up via
// CSS, which still reads as full-field dynamic noise.
const BUFFER_W = 240;
const BUFFER_H = 160;

type Phase =
  | 'pre-rating'
  | 'duration-select'
  | 'adapting'
  | 'post-rating'
  | 'relief-timer'
  | 'round-done'
  | 'worse-warning'
  | 'rest'
  | 'session-done';

interface NoiseAdaptationProps {
  onComplete?: () => void;
}

export default function NoiseAdaptation({ onComplete }: NoiseAdaptationProps) {
  const { profile } = useProfile();
  const { logSession } = useSessionLogger();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>('pre-rating');
  const [preSeverity, setPreSeverity] = useState(5);
  const [contrast, setContrast] = useState(0.7);
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(15);
  const [round, setRound] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [postSeverity, setPostSeverity] = useState(0);
  const [reliefSeconds, setReliefSeconds] = useState(0);
  const [restLeft, setRestLeft] = useState(REST_SECONDS);

  useEffect(() => {
    if (phase !== 'adapting') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    function draw() {
      const imageData = ctx!.createImageData(BUFFER_W, BUFFER_H);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const v = 128 + (Math.random() * 2 - 1) * 127 * contrast;
        const g = Math.max(0, Math.min(255, Math.round(v)));
        imageData.data[i] = g;
        imageData.data[i + 1] = g;
        imageData.data[i + 2] = g;
        imageData.data[i + 3] = 255;
      }
      ctx!.putImageData(imageData, 0, 0);
      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);

    setCountdown(duration);
    const tickId = window.setInterval(() => {
      setCountdown((s) => {
        if (s <= 1) {
          window.clearInterval(tickId);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    const endTimeout = window.setTimeout(() => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setPhase('post-rating');
    }, duration * 1000);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.clearInterval(tickId);
      window.clearTimeout(endTimeout);
    };
  }, [phase, duration, contrast]);

  useEffect(() => {
    if (phase !== 'relief-timer') return;
    const id = window.setInterval(() => setReliefSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'rest') return;
    const id = window.setInterval(() => {
      setRestLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          setPhase('duration-select');
          return REST_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  function startRound() {
    setPhase('adapting');
  }

  function logRound(finalRelief: number) {
    logSession({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      module: 'nopt',
      exercise: 'NoiseAdaptation',
      weakEye: profile.weakEye,
      durationSeconds: duration,
      trials: 1,
      selfRating: { pre: preSeverity, post: postSeverity },
      adaptationReliefDuration: finalRelief,
      notes: `round=${round + 1}/${MAX_ROUNDS}`,
    });
  }

  function reliefGone() {
    logRound(reliefSeconds);
    const nextRound = round + 1;
    setRound(nextRound);
    if (nextRound >= MAX_ROUNDS) {
      setPhase('session-done');
      onComplete?.();
    } else {
      setRestLeft(REST_SECONDS);
      setPhase('rest');
    }
  }

  function submitPostRating(value: number) {
    setPostSeverity(value);
    if (round === 0 && value > preSeverity) {
      setPhase('worse-warning');
    } else {
      setReliefSeconds(0);
      setPhase('relief-timer');
    }
  }

  if (phase === 'pre-rating') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Visual Noise Adaptation</h2>
        <p className="text-sm text-gray-600">Rate your current snow severity before starting.</p>
        <input
          type="range"
          min={0}
          max={10}
          value={preSeverity}
          onChange={(e) => setPreSeverity(Number(e.target.value))}
          className="w-full"
        />
        <div className="text-center text-sm text-gray-500">{preSeverity} / 10</div>
        <button
          type="button"
          onClick={() => setPhase('duration-select')}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Continue
        </button>
      </div>
    );
  }

  if (phase === 'duration-select') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">
          Round {round + 1} of {MAX_ROUNDS}
        </h2>
        <div>
          <div className="mb-1 text-xs font-medium text-gray-500">Duration</div>
          <div className="flex gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  duration === d ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
                }`}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-gray-500">Noise contrast</div>
          <input
            type="range"
            min={0.3}
            max={1.0}
            step={0.05}
            value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <button
          type="button"
          onClick={startRound}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Start
        </button>
      </div>
    );
  }

  if (phase === 'adapting') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black p-4">
        <canvas
          ref={canvasRef}
          width={BUFFER_W}
          height={BUFFER_H}
          className="h-full max-h-[70vh] w-full max-w-2xl"
          style={{ imageRendering: 'auto' }}
        />
        <div className="text-lg font-medium text-white">{countdown}s</div>
      </div>
    );
  }

  if (phase === 'post-rating') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Rate your snow severity now</h2>
        <PostSeveritySlider onSubmit={submitPostRating} />
      </div>
    );
  }

  if (phase === 'worse-warning') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold text-amber-700">Symptoms appear worse</h2>
        <p className="text-sm text-gray-600">
          Your post-round rating ({postSeverity}) is higher than your baseline ({preSeverity}).
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              logRound(0);
              setPhase('session-done');
              onComplete?.();
            }}
            className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white"
          >
            End session
          </button>
          <button
            type="button"
            onClick={() => {
              setReliefSeconds(0);
              setPhase('relief-timer');
            }}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700"
          >
            Continue anyway
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'relief-timer') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-6">
        <h2 className="text-lg font-semibold">Waiting for relief to fade</h2>
        <p className="text-3xl font-semibold text-gray-700">{reliefSeconds}s</p>
        <button
          type="button"
          onClick={reliefGone}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white"
        >
          Relief gone
        </button>
      </div>
    );
  }

  if (phase === 'rest') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-6">
        <h2 className="text-lg font-semibold">Mandatory rest</h2>
        <p className="text-3xl font-semibold text-gray-700">
          {Math.floor(restLeft / 60)}:{(restLeft % 60).toString().padStart(2, '0')}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold">Session complete</h2>
      <p className="text-sm text-gray-700">Completed {round} round(s).</p>
    </div>
  );
}

function PostSeveritySlider({ onSubmit }: { onSubmit: (value: number) => void }) {
  const [value, setValue] = useState(5);
  return (
    <div className="flex flex-col gap-3">
      <input
        type="range"
        min={0}
        max={10}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full"
      />
      <div className="text-center text-sm text-gray-500">{value} / 10</div>
      <button
        type="button"
        onClick={() => onSubmit(value)}
        className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
      >
        Submit
      </button>
    </div>
  );
}
