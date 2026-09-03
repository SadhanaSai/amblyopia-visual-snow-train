import { useCallback, useEffect, useRef, useState } from 'react';
import { useViewingCalibration } from '../hooks/useViewingCalibration';
import { useSessionLogger } from '../hooks/useSessionLogger';
import { drawSinusoidalGrating } from '../utils/canvasUtils';
import {
  CSF_SPATIAL_FREQUENCIES,
  computeAULCSF,
  initCSFPosterior,
  meanCSFParams,
  selectNextCSFStimulus,
  sensitivityAtFrequencies,
  updateCSFPosterior,
  type CSFPosterior,
  type CSFStimulus,
} from '../utils/questPlus';
import type { CSFResult, TestedEye } from '../types/assessment';

const TOTAL_TRIALS = 25;
const STIMULUS_MS = 200;

const ORIENTATION_OPTIONS: { deg: number; key: string; glyph: string; label: string }[] = [
  { deg: 0, key: 'ArrowLeft', glyph: '—', label: '←' },
  { deg: 45, key: 'ArrowUp', glyph: '╱', label: '↑' },
  { deg: 90, key: 'ArrowRight', glyph: '|', label: '→' },
  { deg: 135, key: 'ArrowDown', glyph: '╲', label: '↓' },
];

type Phase = 'cover-check' | 'stimulus' | 'response' | 'eye-done' | 'complete';

interface CSFTestProps {
  onComplete?: () => void;
}

export default function CSFTest({ onComplete }: CSFTestProps) {
  const { degToPx } = useViewingCalibration();
  const { logCSF } = useSessionLogger();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const eyeOrder: TestedEye[] = ['weak', 'strong'];
  const [eyeIndex, setEyeIndex] = useState(0);
  const [coverConfirmed, setCoverConfirmed] = useState(false);
  const [posterior, setPosterior] = useState<CSFPosterior>(() => initCSFPosterior());
  const [trial, setTrial] = useState(0);
  const [phase, setPhase] = useState<Phase>('cover-check');
  const [stimulus, setStimulus] = useState<CSFStimulus | null>(null);
  const [orientationIdx, setOrientationIdx] = useState(0);
  const [completedResults, setCompletedResults] = useState<CSFResult[]>([]);

  const eye = eyeOrder[eyeIndex];
  const pxPerDeg = degToPx(1);

  const startTrial = useCallback(
    (currentPosterior: CSFPosterior) => {
      const next = selectNextCSFStimulus(currentPosterior);
      const orientation = Math.floor(Math.random() * ORIENTATION_OPTIONS.length);
      setStimulus(next);
      setOrientationIdx(orientation);
      setPhase('stimulus');
    },
    [],
  );

  // Draw / clear stimulus and manage the 200ms presentation window.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    if (phase === 'stimulus' && stimulus) {
      drawSinusoidalGrating(ctx, {
        spatialFrequencyCpd: stimulus.sf,
        contrast: stimulus.contrastPct / 100,
        orientation: ORIENTATION_OPTIONS[orientationIdx].deg,
        phase: 0,
        apertureSigmaPx: degToPx(1.5),
        color: 'luminance',
        pxPerDeg,
      });
      const timeout = window.setTimeout(() => {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setPhase('response');
      }, STIMULUS_MS);
      return () => window.clearTimeout(timeout);
    }

    if (phase === 'response') {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [phase, stimulus, orientationIdx, degToPx, pxPerDeg]);

  const finishEye = useCallback(
    (finalPosterior: CSFPosterior) => {
      const params = meanCSFParams(finalPosterior);
      const sensitivities = sensitivityAtFrequencies(params, CSF_SPATIAL_FREQUENCIES);
      const AULCSF = computeAULCSF(sensitivities, CSF_SPATIAL_FREQUENCIES);
      const result: CSFResult = {
        date: new Date().toISOString(),
        eye,
        sf_1cpd: sensitivities[0],
        sf_2cpd: sensitivities[1],
        sf_4cpd: sensitivities[2],
        sf_8cpd: sensitivities[3],
        sf_16cpd: sensitivities[4],
        AULCSF,
      };
      logCSF(result);
      const allResults = [...completedResults, result];
      setCompletedResults(allResults);

      if (eyeIndex + 1 >= eyeOrder.length) {
        setPhase('complete');
        onComplete?.();
      } else {
        setEyeIndex(eyeIndex + 1);
        setCoverConfirmed(false);
        setPosterior(initCSFPosterior());
        setTrial(0);
        setPhase('cover-check');
      }
    },
    [eye, eyeIndex, eyeOrder.length, completedResults, logCSF, onComplete],
  );

  // Respond to arrow-key presses from stimulus onset through the response
  // window — a 200ms flash is fast enough that a quick, attentive response
  // often lands before the phase flips to 'response'; gating strictly on
  // 'response' silently dropped those presses.
  useEffect(() => {
    if ((phase !== 'stimulus' && phase !== 'response') || !stimulus) return;
    function onKeyDown(e: KeyboardEvent) {
      const choiceIdx = ORIENTATION_OPTIONS.findIndex((o) => o.key === e.key);
      if (choiceIdx === -1) return;
      e.preventDefault();
      const correct = choiceIdx === orientationIdx;
      const nextPosterior = updateCSFPosterior(posterior, stimulus!, correct);
      setPosterior(nextPosterior);
      const nextTrial = trial + 1;
      setTrial(nextTrial);
      if (nextTrial >= TOTAL_TRIALS) {
        finishEye(nextPosterior);
      } else {
        startTrial(nextPosterior);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stimulus, orientationIdx, posterior, trial, finishEye, startTrial]);

  if (phase === 'cover-check') {
    const otherEye = eye === 'weak' ? 'strong' : 'weak';
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Contrast Sensitivity — {eye} eye</h2>
        <p className="text-sm text-gray-600">Cover your {otherEye} eye completely before starting.</p>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={coverConfirmed}
            onChange={(e) => setCoverConfirmed(e.target.checked)}
          />
          I've covered my {otherEye} eye
        </label>
        <button
          type="button"
          disabled={!coverConfirmed}
          onClick={() => startTrial(posterior)}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Start
        </button>
      </div>
    );
  }

  if (phase === 'complete') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Contrast sensitivity test complete</h2>
        {completedResults.map((r) => (
          <div key={r.eye} className="rounded border border-gray-200 p-3 text-sm">
            <div className="font-medium capitalize">{r.eye} eye</div>
            <div className="text-xs text-gray-500">AULCSF: {r.AULCSF.toFixed(2)}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold capitalize">Contrast Sensitivity — {eye} eye</h2>
      <div className="text-xs text-gray-400">
        Trial {trial + 1} / {TOTAL_TRIALS}
      </div>
      <canvas
        ref={canvasRef}
        width={320}
        height={320}
        className="mx-auto rounded border border-gray-200 bg-[#808080]"
      />
      <p className="text-center text-sm text-gray-600">
        Which way was the pattern tilted? Press the matching arrow key.
      </p>
      <div className="flex justify-center gap-4 text-lg text-gray-500">
        {ORIENTATION_OPTIONS.map((o) => (
          <span key={o.key}>{o.label}</span>
        ))}
      </div>
    </div>
  );
}
