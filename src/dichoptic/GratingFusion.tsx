import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfile } from '../profile/ProfileContext';
import { useViewingCalibration } from '../hooks/useViewingCalibration';
import { useSessionLogger } from '../hooks/useSessionLogger';
import { useStaircase } from '../hooks/useStaircase';
import { useAdaptiveICR } from '../hooks/useAdaptiveICR';
import { useResponsiveSquareCanvas } from '../hooks/useResponsiveSquareCanvas';
import { compositeAnaglyph, drawSinusoidalGrating } from '../utils/canvasUtils';
import { strongChannel, weakChannel } from '../utils/colorUtils';
import type { StaircaseConfig } from '../types/staircase';

const SPATIAL_FREQUENCIES = [1, 2, 4, 8] as const;
const TEMPORAL_CONDITIONS = [
  { value: 'static', label: 'Static' },
  { value: 'flicker1', label: '1Hz counterphase' },
  { value: 'flicker4', label: '4Hz counterphase' },
] as const;
type TemporalCondition = (typeof TEMPORAL_CONDITIONS)[number]['value'];

const MAX_TRIALS = 40;
const STIMULUS_MS = 2000;
const ISI_MS = 500;
const RESPONSE_MS = 500;

type Phase = 'setup' | 'stimulus' | 'isi' | 'response' | 'done';

interface GratingFusionProps {
  onComplete?: () => void;
}

export default function GratingFusion({ onComplete }: GratingFusionProps) {
  const { profile } = useProfile();
  const { degToPx } = useViewingCalibration();
  const { logSession } = useSessionLogger();
  const adaptiveICR = useAdaptiveICR();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { containerRef, size } = useResponsiveSquareCanvas();

  const [spatialFrequency, setSpatialFrequency] = useState<(typeof SPATIAL_FREQUENCIES)[number]>(2);
  const [temporalCondition, setTemporalCondition] = useState<TemporalCondition>('static');
  const [phase, setPhase] = useState<Phase>('setup');
  const [trial, setTrial] = useState(0);
  const [fusionCount, setFusionCount] = useState(0);
  const startedAtRef = useRef(performance.now());

  const [config] = useState<StaircaseConfig>(() => ({
    type: '2down1up',
    startValue: adaptiveICR.currentICR,
    stepSize: 0.05,
    stepSizeAfterReversal: 0.025,
    minReversals: 6,
    minValue: 0.1,
    maxValue: 1.0,
    logScale: false,
  }));
  const staircase = useStaircase(config);

  const pxPerDeg = degToPx(1);
  const apertureSigmaPx = degToPx(2);

  const drawTrial = useCallback(
    (flipped: boolean) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const weak = document.createElement('canvas');
      weak.width = canvas.width;
      weak.height = canvas.height;
      const strong = document.createElement('canvas');
      strong.width = canvas.width;
      strong.height = canvas.height;
      drawSinusoidalGrating(weak.getContext('2d')!, {
        spatialFrequencyCpd: spatialFrequency,
        contrast: 0.9,
        orientation: 90,
        phase: flipped ? Math.PI : 0,
        apertureSigmaPx,
        color: weakChannel(profile),
        pxPerDeg,
      });
      drawSinusoidalGrating(strong.getContext('2d')!, {
        spatialFrequencyCpd: spatialFrequency,
        contrast: staircase.currentValue * 0.9,
        orientation: 0,
        phase: flipped ? Math.PI : 0,
        apertureSigmaPx,
        color: strongChannel(profile),
        pxPerDeg,
      });
      compositeAnaglyph(weak, strong, ctx);
    },
    [spatialFrequency, apertureSigmaPx, pxPerDeg, staircase.currentValue, profile.lensType, profile.weakEyeChannel],
  );

  const handleResponse = useCallback(
    (fused: boolean) => {
      staircase.respond(fused);
      const nextTrial = trial + 1;
      const nextFusionCount = fused ? fusionCount + 1 : fusionCount;
      setTrial(nextTrial);
      setFusionCount(nextFusionCount);

      if (nextTrial >= MAX_TRIALS || staircase.state.complete) {
        const threshold = staircase.state.threshold ?? staircase.currentValue;
        adaptiveICR.updateFromSession(threshold);
        logSession({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          module: 'dichoptic',
          exercise: 'GratingFusion',
          displayMode: 'anaglyph',
          weakEye: profile.weakEye,
          durationSeconds: Math.round((performance.now() - startedAtRef.current) / 1000),
          trials: nextTrial,
          accuracy: nextFusionCount / nextTrial,
          staircaseThreshold: threshold,
          thresholdUnit: 'ICR',
          icrUsed: threshold,
          notes: `sf=${spatialFrequency}cpd temporal=${temporalCondition}`,
        });
        setPhase('done');
        onComplete?.();
      } else {
        setPhase('stimulus');
      }
    },
    [
      staircase,
      trial,
      fusionCount,
      adaptiveICR,
      logSession,
      profile.weakEye,
      spatialFrequency,
      temporalCondition,
      onComplete,
    ],
  );

  // Stimulus presentation: draw once (static) or flip phase on an interval (flicker), for 2000ms.
  useEffect(() => {
    if (phase !== 'stimulus') return;
    let flipped = false;
    drawTrial(flipped);

    let intervalId: number | undefined;
    if (temporalCondition !== 'static') {
      const freq = temporalCondition === 'flicker1' ? 1 : 4;
      const halfPeriodMs = 1000 / (2 * freq);
      intervalId = window.setInterval(() => {
        flipped = !flipped;
        drawTrial(flipped);
      }, halfPeriodMs);
    }

    const stimTimeout = window.setTimeout(() => {
      if (intervalId !== undefined) window.clearInterval(intervalId);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      setPhase('isi');
    }, STIMULUS_MS);

    return () => {
      if (intervalId !== undefined) window.clearInterval(intervalId);
      window.clearTimeout(stimTimeout);
    };
  }, [phase, temporalCondition, drawTrial, size]);

  useEffect(() => {
    if (phase !== 'isi') return;
    const t = window.setTimeout(() => setPhase('response'), ISI_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'response') return;
    let responded = false;
    function onKey(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (key !== 'f' && key !== 'r') return;
      responded = true;
      handleResponse(key === 'f');
    }
    window.addEventListener('keydown', onKey);
    const timeout = window.setTimeout(() => {
      if (!responded) handleResponse(false);
    }, RESPONSE_MS);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timeout);
    };
  }, [phase, handleResponse]);

  if (phase === 'setup') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Contrast-Defined Grating Fusion</h2>
        <div>
          <div className="mb-1 text-xs font-medium text-gray-500">Spatial frequency</div>
          <div className="flex gap-2">
            {SPATIAL_FREQUENCIES.map((sf) => (
              <button
                key={sf}
                type="button"
                onClick={() => setSpatialFrequency(sf)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  spatialFrequency === sf ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
                }`}
              >
                {sf} cpd
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-gray-500">Temporal modulation</div>
          <div className="flex flex-col gap-2">
            {TEMPORAL_CONDITIONS.map((tc) => (
              <button
                key={tc.value}
                type="button"
                onClick={() => setTemporalCondition(tc.value)}
                className={`rounded-lg border p-2 text-left text-sm ${
                  temporalCondition === tc.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                }`}
              >
                {tc.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            startedAtRef.current = performance.now();
            setPhase('stimulus');
          }}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Start (put on your glasses)
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Session complete</h2>
        <p className="text-sm text-gray-700">
          Fusion rate: {((fusionCount / Math.max(1, trial)) * 100).toFixed(0)}%
        </p>
        <p className="text-sm text-gray-700">
          Threshold ICR: {(staircase.state.threshold ?? staircase.currentValue).toFixed(2)}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          Trial {trial + 1} / {MAX_TRIALS}
        </span>
        {trial > 0 && <span>{((fusionCount / trial) * 100).toFixed(0)}% fused</span>}
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${(trial / MAX_TRIALS) * 100}%` }}
        />
      </div>
      <div ref={containerRef} className="relative mx-auto aspect-square w-full">
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          className="absolute inset-0 h-full w-full rounded border border-gray-200 bg-[#808080]"
        />
      </div>
      <p className="text-center text-sm text-gray-600">
        Press <strong>F</strong> if fused (single oblique plaid) or <strong>R</strong> if rivalry
        (alternating patterns).
      </p>
    </div>
  );
}
