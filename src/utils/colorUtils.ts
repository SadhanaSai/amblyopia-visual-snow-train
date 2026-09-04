import { DEFAULT_LENS_TYPE, type LensType, type WeakEye } from '../types/profile';

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

// The "non-red" channel's base color has to match the physical lens or it
// leaks/dims through the wrong eye instead of fully separating — red/cyan
// and red/green are the two anaglyph standards this app supports.
const STRONG_EYE_COLOR_BY_LENS: Record<LensType, [number, number, number]> = {
  'red-cyan': [0, 255, 255],
  'red-green': [0, 255, 0],
};

export function strongEyeBaseColor(lensType: LensType): [number, number, number] {
  return STRONG_EYE_COLOR_BY_LENS[lensType];
}

/**
 * Weak eye always renders at full saturation; strong eye is ICR-blended
 * toward white so its channel contributes proportionally less contrast.
 */
export function getDichopticColors(
  weakEye: WeakEye,
  icr: number,
  lensType: LensType = DEFAULT_LENS_TYPE,
): { leftEyeColor: string; rightEyeColor: string } {
  const weakColor = `rgb(${WEAK_EYE_RED.join(', ')})`;
  const strongColor = applyICR(strongEyeBaseColor(lensType), icr);
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
