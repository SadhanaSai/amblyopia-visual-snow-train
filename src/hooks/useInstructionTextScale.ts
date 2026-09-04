import { useCallback, useState } from 'react';

const STORAGE_KEY = 'instruction_text_scale';
const SCALES = [1, 1.15, 1.3, 1.5] as const;

function loadScale(): number {
  const raw = Number(localStorage.getItem(STORAGE_KEY));
  return (SCALES as readonly number[]).includes(raw) ? raw : SCALES[0];
}

/**
 * Text size for instruction-only screens (exercise/assessment intros), kept
 * independent of browser zoom: browser zoom rescales the whole page including
 * calibrated stimulus canvases, silently invalidating the physical/visual-angle
 * sizing calibration derives. This scale only ever applies to plain instruction
 * text, never to a canvas, so it can't affect calibration.
 */
export function useInstructionTextScale() {
  const [scale, setScale] = useState<number>(loadScale);

  const step = useCallback((delta: 1 | -1) => {
    setScale((current) => {
      const index = SCALES.indexOf(current as (typeof SCALES)[number]);
      const next = SCALES[Math.min(Math.max(index + delta, 0), SCALES.length - 1)];
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return {
    scale,
    increase: () => step(1),
    decrease: () => step(-1),
    canIncrease: scale !== SCALES[SCALES.length - 1],
    canDecrease: scale !== SCALES[0],
  };
}
