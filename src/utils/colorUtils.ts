import {
  DEFAULT_LENS_TYPE,
  DEFAULT_WEAK_EYE_CHANNEL,
  type LensType,
  type UserProfile,
  type WeakEye,
} from '../types/profile';

/**
 * ICR blending, dichoptic channel colors, anaglyph channel separation.
 */

export type Channel = 'red' | 'cyan' | 'green';

const CHANNEL_RGB: Record<Channel, [number, number, number]> = {
  red: [255, 0, 0],
  cyan: [0, 255, 255],
  green: [0, 255, 0],
};

export function channelRgb(channel: Channel): [number, number, number] {
  return CHANNEL_RGB[channel];
}

export function channelToRgbString(channel: Channel): string {
  return `rgb(${CHANNEL_RGB[channel].join(', ')})`;
}

/** The channel's base color scaled toward black by `intensity` (1 = full saturation, 0 = black) — used for contrast sweeps on the weak eye's own channel. */
export function channelColorAtIntensity(channel: Channel, intensity: number): string {
  const clamped = Math.min(1, Math.max(0, intensity));
  const scale = (c: number) => Math.round(c * clamped);
  return `rgb(${CHANNEL_RGB[channel].map(scale).join(', ')})`;
}

/** Blends a base color toward white by (1 - icr): icr 1.0 = full saturation, icr 0.1 = near white. */
export function applyICR(baseColor: [number, number, number], icr: number): string {
  const clamped = Math.min(1, Math.max(0, icr));
  const [r, g, b] = baseColor;
  const blend = (c: number) => Math.round(c + (255 - c) * (1 - clamped));
  return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
}

/** The non-red anaglyph channel for a lens standard — must match the physical lens or it leaks/dims instead of fully separating. */
export function otherChannel(lensType: LensType): Channel {
  return lensType === 'red-green' ? 'green' : 'cyan';
}

export function strongEyeBaseColor(lensType: LensType): [number, number, number] {
  return CHANNEL_RGB[otherChannel(lensType)];
}

type ChannelProfile = Pick<UserProfile, 'lensType' | 'weakEyeChannel'>;

/**
 * Molded anaglyph glasses can't be reoriented to put a chosen color over a
 * chosen eye — which eye sees red vs. the other color is fixed by the
 * glasses. So which physical channel the weak eye's content should be
 * tinted with is a profile setting (weakEyeChannel), not always 'red'.
 */
export function weakChannel(profile: ChannelProfile): Channel {
  const setting = profile.weakEyeChannel ?? DEFAULT_WEAK_EYE_CHANNEL;
  return setting === 'red' ? 'red' : otherChannel(profile.lensType ?? DEFAULT_LENS_TYPE);
}

export function strongChannel(profile: ChannelProfile): Channel {
  const weak = weakChannel(profile);
  return weak === 'red' ? otherChannel(profile.lensType ?? DEFAULT_LENS_TYPE) : 'red';
}

/** Which channel color the given anatomical eye's content should be tinted, given weakEye + weakEyeChannel. */
export function channelForEye(
  profile: ChannelProfile & { weakEye: WeakEye },
  eye: WeakEye,
): Channel {
  return eye === profile.weakEye ? weakChannel(profile) : strongChannel(profile);
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  const toHex = (c: number) => c.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** HSL hue (0-360) + saturation/opacity -> rgba string, used by ChromaticSimulator. */
export function hslaFromControls(hue: number, saturationPct: number, opacityPct: number): string {
  return `hsla(${hue}, ${saturationPct}%, 50%, ${opacityPct / 100})`;
}
