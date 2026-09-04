import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfile } from '../profile/ProfileContext';
import { useViewingCalibration } from '../hooks/useViewingCalibration';
import { useSessionLogger } from '../hooks/useSessionLogger';
import { useStaircase } from '../hooks/useStaircase';
import { useAdaptiveICR } from '../hooks/useAdaptiveICR';
import {
  applyICR,
  channelColorAtIntensity,
  channelRgb,
  channelToRgbString,
  strongChannel,
  weakChannel,
  type Channel,
} from '../utils/colorUtils';
import { compositeAnaglyph, drawSloanLetter, SLOAN_LETTERS } from '../utils/canvasUtils';
import type { StaircaseConfig } from '../types/staircase';

type Paradigm = 'flanked' | 'contrast' | 'vernier';

const PARADIGM_LABELS: Record<Paradigm, string> = {
  flanked: 'Flanked letter (crowding)',
  contrast: 'Contrast sensitivity sweep',
  vernier: 'Vernier acuity',
};

const MAX_TRIALS = 60;
const CANVAS_SIZE = 320;

function randomLetter(): string {
  return SLOAN_LETTERS[Math.floor(Math.random() * SLOAN_LETTERS.length)];
}

function drawBlankStrongField(
  ctx: CanvasRenderingContext2D,
  radiusPx: number,
  icr: number,
  channel: Channel,
): void {
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.fillStyle = applyICR(channelRgb(channel), icr);
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, radiusPx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function configFor(paradigm: Paradigm): StaircaseConfig {
  switch (paradigm) {
    case 'flanked':
      return {
        type: '2down1up',
        startValue: 3,
        stepSize: 0.5,
        stepSizeAfterReversal: 0.25,
        minReversals: 6,
        minValue: 0.5,
        maxValue: 4,
        logScale: false,
      };
    case 'contrast':
      return {
        type: '3down1up',
        startValue: 0.5,
        stepSize: 0.15,
        stepSizeAfterReversal: 0.075,
        minReversals: 6,
        minValue: 0.01,
        maxValue: 1,
        logScale: true,
      };
    case 'vernier':
      return {
        type: '2down1up',
        startValue: 120,
        stepSize: 0.15,
        stepSizeAfterReversal: 0.075,
        minReversals: 6,
        minValue: 5,
        maxValue: 600,
        logScale: true,
      };
  }
}

interface LetterDiscriminationProps {
  onComplete?: () => void;
}

export default function LetterDiscrimination({ onComplete }: LetterDiscriminationProps) {
  const { profile } = useProfile();
  const { degToPx, arcSecToPx } = useViewingCalibration();
  const { logSession } = useSessionLogger();
  const adaptiveICR = useAdaptiveICR();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startedAtRef = useRef(performance.now());
  const [paradigm, setParadigm] = useState<Paradigm | null>(null);
  const [config, setConfig] = useState<StaircaseConfig | null>(null);
  const staircase = useStaircase(config ?? configFor('flanked'));

  const [target, setTarget] = useState<string>(randomLetter());
  const [vernierDirection, setVernierDirection] = useState<'left' | 'right'>('left');
  const [input, setInput] = useState('');
  const [trial, setTrial] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const strongEyeIcr = paradigm === 'contrast' ? 0.1 : adaptiveICR.currentICR;

  const drawTrial = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !paradigm) return;
    const weak = document.createElement('canvas');
    weak.width = canvas.width;
    weak.height = canvas.height;
    const strong = document.createElement('canvas');
    strong.width = canvas.width;
    strong.height = canvas.height;
    const weakCtx = weak.getContext('2d')!;
    const strongCtx = strong.getContext('2d')!;

    const weakCh = weakChannel(profile);
    const strongCh = strongChannel(profile);
    const weakColor = channelToRgbString(weakCh);

    if (paradigm === 'flanked') {
      const sizePx = Math.max(12, degToPx(0.4));
      const letterWidthPx = sizePx * 0.8;
      const spacingPx = letterWidthPx * staircase.currentValue;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      drawSloanLetter(weakCtx, target, { centerX: cx - spacingPx, centerY: cy, sizePx, color: weakColor });
      drawSloanLetter(weakCtx, target, { centerX: cx + spacingPx, centerY: cy, sizePx, color: weakColor });
      drawSloanLetter(weakCtx, target, { centerX: cx, centerY: cy, sizePx, color: weakColor });
      drawBlankStrongField(strongCtx, sizePx * 2, strongEyeIcr, strongCh);
    } else if (paradigm === 'contrast') {
      const sizePx = Math.max(12, degToPx(0.5));
      drawSloanLetter(weakCtx, target, {
        centerX: canvas.width / 2,
        centerY: canvas.height / 2,
        sizePx,
        color: channelColorAtIntensity(weakCh, 1 - staircase.currentValue),
      });
      drawBlankStrongField(strongCtx, sizePx * 1.5, strongEyeIcr, strongCh);
    } else {
      const offsetPx = arcSecToPx(staircase.currentValue) * (vernierDirection === 'left' ? -1 : 1);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      weakCtx.strokeStyle = weakColor;
      weakCtx.lineWidth = 3;
      weakCtx.beginPath();
      weakCtx.moveTo(cx + offsetPx, cy - 30);
      weakCtx.lineTo(cx + offsetPx, cy - 4);
      weakCtx.moveTo(cx, cy + 4);
      weakCtx.lineTo(cx, cy + 30);
      weakCtx.stroke();
      drawBlankStrongField(strongCtx, 40, strongEyeIcr, strongCh);
    }

    compositeAnaglyph(weak, strong, ctx);
  }, [
    paradigm,
    target,
    staircase.currentValue,
    vernierDirection,
    degToPx,
    arcSecToPx,
    strongEyeIcr,
    profile.lensType,
    profile.weakEyeChannel,
  ]);

  useEffect(() => {
    if (paradigm) drawTrial();
  }, [paradigm, drawTrial]);

  function nextTrial() {
    setTarget(randomLetter());
    setVernierDirection(Math.random() < 0.5 ? 'left' : 'right');
    setInput('');
  }

  function finish(finalTrial: number, finalCorrect: number) {
    const threshold = staircase.state.threshold ?? staircase.currentValue;
    const unit = paradigm === 'flanked' ? 'letter-widths' : paradigm === 'contrast' ? 'Michelson contrast' : 'arcsec';
    adaptiveICR.updateFromSession(paradigm === 'contrast' ? 0.1 : threshold);
    logSession({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      module: 'dichoptic',
      exercise: 'LetterDiscrimination',
      paradigm: paradigm ?? undefined,
      displayMode: 'anaglyph',
      weakEye: profile.weakEye,
      durationSeconds: Math.round((performance.now() - startedAtRef.current) / 1000),
      trials: finalTrial,
      accuracy: finalCorrect / Math.max(1, finalTrial),
      staircaseThreshold: threshold,
      thresholdUnit: unit,
      icrUsed: strongEyeIcr,
    });
    setDone(true);
    onComplete?.();
  }

  function submit() {
    let correct = false;
    if (paradigm === 'vernier') {
      correct = input === vernierDirection;
    } else {
      correct = input.trim().toUpperCase() === target;
    }
    staircase.respond(correct);
    const nextTrialCount = trial + 1;
    const nextCorrect = correct ? correctCount + 1 : correctCount;
    setTrial(nextTrialCount);
    setCorrectCount(nextCorrect);

    if (nextTrialCount >= MAX_TRIALS || staircase.state.complete) {
      finish(nextTrialCount, nextCorrect);
    } else {
      nextTrial();
    }
  }

  function startParadigm(p: Paradigm) {
    startedAtRef.current = performance.now();
    setParadigm(p);
    setConfig(configFor(p));
    setTrial(0);
    setCorrectCount(0);
    nextTrial();
  }

  if (!paradigm) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Letter / Optotype Discrimination</h2>
        <p className="text-sm text-gray-600">Choose a paradigm.</p>
        <div className="flex flex-col gap-2">
          {(Object.keys(PARADIGM_LABELS) as Paradigm[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => startParadigm(p)}
              className="rounded-lg border border-gray-200 p-3 text-left text-sm font-medium"
            >
              {PARADIGM_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Session complete — {PARADIGM_LABELS[paradigm]}</h2>
        <p className="text-sm text-gray-700">Accuracy: {((correctCount / Math.max(1, trial)) * 100).toFixed(0)}%</p>
        <p className="text-sm text-gray-700">
          Threshold: {(staircase.state.threshold ?? staircase.currentValue).toFixed(2)}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold">{PARADIGM_LABELS[paradigm]}</h2>
      <div className="text-xs text-gray-400">
        Trial {trial + 1} / {MAX_TRIALS}
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="mx-auto rounded border border-gray-200 bg-[#808080]"
      />
      {paradigm === 'vernier' ? (
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setInput('left');
              submit();
            }}
            className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium"
          >
            ← Left
          </button>
          <button
            type="button"
            onClick={() => {
              setInput('right');
              submit();
            }}
            className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium"
          >
            Right →
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            maxLength={1}
            placeholder="Letter"
            className="flex-1 rounded border border-gray-300 p-2 text-center text-lg uppercase"
            autoFocus
          />
          <button
            type="button"
            onClick={submit}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
