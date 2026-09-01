import type { WeakEye } from '../types/profile';

/**
 * ICR blending, dichoptic channel colors, anaglyph channel separation.
 */

/** Blends a base color toward white by (1 - icr): icr 1.0 = full saturation, icr 0.1 = near white. */
export function applyICR(baseColor: [number, number, number], icr: number): string {
  const clamped = Math.min(1, Math.max(0, icr));
  const [r, g, b] = baseColor;
  const blend = (c: number) => Math.round(c + (255 - c) * (1 - clamped));
  return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
}

const WEAK_EYE_RED: [number, number, number] = [255, 0, 0];
const STRONG_EYE_CYAN: [number, number, number] = [0, 255, 255];

/**
 * Weak eye always renders at full saturation; strong eye is ICR-blended
 * toward white so its channel contributes proportionally less contrast.
 */
export function getDichopticColors(
  weakEye: WeakEye,
  icr: number,
): { leftEyeColor: string; rightEyeColor: string } {
  const weakColor = `rgb(${WEAK_EYE_RED.join(', ')})`;
  const strongColor = applyICR(STRONG_EYE_CYAN, icr);
  return weakEye === 'left'
    ? { leftEyeColor: weakColor, rightEyeColor: strongColor }
    : { leftEyeColor: strongColor, rightEyeColor: weakColor };
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  const toHex = (c: number) => c.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** HSL hue (0-360) + saturation/opacity -> rgba string, used by ChromaticSimulator. */
export function hslaFromControls(hue: number, saturationPct: number, opacityPct: number): string {
  return `hsla(${hue}, ${saturationPct}%, 50%, ${opacityPct / 100})`;
}
