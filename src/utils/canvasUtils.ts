/**
 * All stimulus rendering primitives. Pure Canvas 2D — no WebGL, no DOM
 * component libraries. Every size that maps to a physical/visual-angle unit
 * takes `pxPerDeg` (from useViewingCalibration.degToPx) rather than baking in
 * a conversion here, so this module stays independent of calibration state.
 */

// --- Sinusoidal grating -----------------------------------------------

export interface GratingOptions {
  spatialFrequencyCpd: number;
  contrast: number; // 0-1 Michelson
  orientation: number; // degrees
  phase: number; // radians
  apertureSigmaPx: number; // Gaussian window sigma
  color: 'luminance' | 'red' | 'cyan';
  pxPerDeg: number;
  centerX?: number;
  centerY?: number;
  diameterPx?: number; // defaults to 6 sigma (covers ~3 sigma radius)
}

export function drawSinusoidalGrating(ctx: CanvasRenderingContext2D, opts: GratingOptions): void {
  const { width, height } = ctx.canvas;
  const cx = opts.centerX ?? width / 2;
  const cy = opts.centerY ?? height / 2;
  const diameter = opts.diameterPx ?? opts.apertureSigmaPx * 6;
  const radius = diameter / 2;
  const left = Math.max(0, Math.floor(cx - radius));
  const top = Math.max(0, Math.floor(cy - radius));
  const right = Math.min(width, Math.ceil(cx + radius));
  const bottom = Math.min(height, Math.ceil(cy + radius));
  const boxW = right - left;
  const boxH = bottom - top;
  if (boxW <= 0 || boxH <= 0) return;

  const imageData = ctx.createImageData(boxW, boxH);
  const cyclesPerPx = opts.spatialFrequencyCpd / opts.pxPerDeg;
  const theta = (opts.orientation * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const twoSigmaSq = 2 * opts.apertureSigmaPx * opts.apertureSigmaPx;

  for (let y = 0; y < boxH; y++) {
    for (let x = 0; x < boxW; x++) {
      const px = left + x;
      const py = top + y;
      const dx = px - cx;
      const dy = py - cy;
      const proj = dx * cosT + dy * sinT;
      const lum = 0.5 + 0.5 * opts.contrast * Math.sin(2 * Math.PI * cyclesPerPx * proj + opts.phase);
      const envelope = Math.exp(-(dx * dx + dy * dy) / twoSigmaSq);
      const gray = Math.round(255 * Math.min(1, Math.max(0, lum)));
      const idx = (y * boxW + x) * 4;
      if (opts.color === 'red') {
        imageData.data[idx] = gray;
        imageData.data[idx + 1] = 0;
        imageData.data[idx + 2] = 0;
      } else if (opts.color === 'cyan') {
        imageData.data[idx] = 0;
        imageData.data[idx + 1] = gray;
        imageData.data[idx + 2] = gray;
      } else {
        imageData.data[idx] = gray;
        imageData.data[idx + 1] = gray;
        imageData.data[idx + 2] = gray;
      }
      imageData.data[idx + 3] = Math.round(255 * envelope);
    }
  }
  ctx.putImageData(imageData, left, top);
}

// --- Random dot kinematogram --------------------------------------------

export interface RDKConfig {
  nDots: number;
  coherence: number; // 0-1
  directionDeg: number;
  speedDegPerSec: number;
  dotLifetimeFrames: number;
  fieldDiameterPx: number;
  dotRadiusPx: number;
  eye: 'weak' | 'strong' | 'both';
  icr: number;
}

interface RDKDot {
  x: number; // px, relative to field center
  y: number;
  angleDeg: number;
  coherent: boolean;
  framesRemaining: number;
}

export interface RDKState {
  config: RDKConfig;
  dots: RDKDot[];
  pxPerDeg: number;
}

function randomPointInCircle(radius: number): { x: number; y: number } {
  const r = radius * Math.sqrt(Math.random());
  const a = Math.random() * Math.PI * 2;
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
}

function spawnDot(config: RDKConfig): RDKDot {
  const { x, y } = randomPointInCircle(config.fieldDiameterPx / 2);
  const coherent = Math.random() < config.coherence;
  return {
    x,
    y,
    angleDeg: coherent ? config.directionDeg : Math.random() * 360,
    coherent,
    framesRemaining: config.dotLifetimeFrames,
  };
}

export function createRDK(config: RDKConfig, pxPerDeg: number): RDKState {
  return { config, dots: Array.from({ length: config.nDots }, () => spawnDot(config)), pxPerDeg };
}

export function stepRDK(state: RDKState, deltaTimeMs: number): RDKState {
  const { config, pxPerDeg } = state;
  const radius = config.fieldDiameterPx / 2;
  const dots = state.dots.map((dot) => {
    const speedPxPerSec = config.speedDegPerSec * pxPerDeg;
    const distPx = speedPxPerSec * (deltaTimeMs / 1000);
    const rad = (dot.angleDeg * Math.PI) / 180;
    const x = dot.x + distPx * Math.cos(rad);
    const y = dot.y + distPx * Math.sin(rad);
    const framesRemaining = dot.framesRemaining - 1;

    const outOfField = x * x + y * y > radius * radius;
    if (framesRemaining <= 0 || outOfField) return spawnDot(config);
    return { ...dot, x, y, framesRemaining };
  });
  return { ...state, dots };
}

export function drawRDK(
  ctx: CanvasRenderingContext2D,
  state: RDKState,
  centerX?: number,
  centerY?: number,
): void {
  const { width, height } = ctx.canvas;
  const cx = centerX ?? width / 2;
  const cy = centerY ?? height / 2;
  // 'weak'/'strong' route dots into the matching anaglyph channel so this
  // layer can be composited via compositeAnaglyph(); 'both' renders a plain
  // luminance layer for side-by-side/screen-only display modes.
  const colorMode: 'red' | 'cyan' | 'luminance' =
    state.config.eye === 'weak' ? 'red' : state.config.eye === 'strong' ? 'cyan' : 'luminance';

  for (const dot of state.dots) {
    const alpha = dot.coherent ? 1 : state.config.icr;
    const fill =
      colorMode === 'red'
        ? `rgba(255, 0, 0, ${alpha})`
        : colorMode === 'cyan'
          ? `rgba(0, 255, 255, ${alpha})`
          : `rgba(255, 255, 255, ${alpha})`;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(cx + dot.x, cy + dot.y, state.config.dotRadiusPx, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Sloan optotypes ------------------------------------------------------
// Simplified vector approximation of the Sloan letter set (not the licensed
// font) drawn on a 4x5 unit grid as blocky strokes — sufficient for
// discrimination-task rendering without a system-font dependency.

const SLOAN_PATHS: Record<string, number[][][]> = {
  C: [[[4, 0], [1, 0], [0, 1], [0, 4], [1, 5], [4, 5]]],
  D: [[[0, 0], [0, 5]], [[0, 0], [3, 0], [4, 1], [4, 4], [3, 5], [0, 5]]],
  H: [[[0, 0], [0, 5]], [[4, 0], [4, 5]], [[0, 2.5], [4, 2.5]]],
  K: [[[0, 0], [0, 5]], [[4, 0], [0, 2.5], [4, 5]]],
  N: [[[0, 5], [0, 0], [4, 5], [4, 0]]],
  O: [[[1, 0], [3, 0], [4, 1], [4, 4], [3, 5], [1, 5], [0, 4], [0, 1], [1, 0]]],
  R: [[[0, 5], [0, 0], [3, 0], [4, 1], [3, 2.5], [0, 2.5]], [[2, 2.5], [4, 5]]],
  S: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 2.5], [3, 2.5], [4, 3], [4, 4], [3, 5], [1, 5], [0, 4]]],
  V: [[[0, 0], [2, 5], [4, 0]]],
  Z: [[[0, 0], [4, 0], [0, 5], [4, 5]]],
};

export interface SloanLetterOptions {
  centerX: number;
  centerY: number;
  sizePx: number; // letter height
  color: string;
}

export function drawSloanLetter(
  ctx: CanvasRenderingContext2D,
  letter: string,
  opts: SloanLetterOptions,
): void {
  const paths = SLOAN_PATHS[letter.toUpperCase()];
  if (!paths) return;
  const scale = opts.sizePx / 5;
  const startX = opts.centerX - (4 * scale) / 2;
  const startY = opts.centerY - opts.sizePx / 2;

  ctx.save();
  ctx.strokeStyle = opts.color;
  ctx.lineWidth = scale * 0.9;
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  for (const path of paths) {
    ctx.beginPath();
    path.forEach(([gx, gy], i) => {
      const x = startX + gx * scale;
      const y = startY + gy * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.restore();
}

export const SLOAN_LETTERS = ['C', 'D', 'H', 'K', 'N', 'O', 'R', 'S', 'V', 'Z'] as const;

// --- Dichoptic text --------------------------------------------------------

export interface DichopticTextOptions {
  mode: 'word' | 'line' | 'phrase';
  weakEyeColor: string;
  strongEyeColor: string;
  canvasWidth: number;
  lineHeight: number;
  fontSize: number;
  fontFamily: string;
  startX?: number;
  startY?: number;
}

export function renderDichopticText(
  ctx: CanvasRenderingContext2D,
  passage: string,
  opts: DichopticTextOptions,
): void {
  ctx.font = `${opts.fontSize}px ${opts.fontFamily}`;
  ctx.textBaseline = 'alphabetic';
  const words = passage.split(/\s+/).filter(Boolean);
  const startX = opts.startX ?? 20;
  let x = startX;
  let y = opts.startY ?? opts.fontSize + 20;
  const spaceWidth = ctx.measureText(' ').width;

  // Phrase boundaries: a new phrase begins after any word ending in ,.;:
  let phraseIndex = 0;
  const phraseIndices: number[] = words.map((word) => {
    const current = phraseIndex;
    if (/[,.;:]$/.test(word)) phraseIndex++;
    return current;
  });

  let lineIndex = 0;
  let wordsOnLine = 0;

  words.forEach((word, i) => {
    const wordWidth = ctx.measureText(word).width;
    if (x + wordWidth > startX + opts.canvasWidth && wordsOnLine > 0) {
      x = startX;
      y += opts.lineHeight;
      lineIndex++;
      wordsOnLine = 0;
    }
    const color =
      opts.mode === 'word'
        ? i % 2 === 0
          ? opts.weakEyeColor
          : opts.strongEyeColor
        : opts.mode === 'line'
          ? lineIndex % 2 === 0
            ? opts.weakEyeColor
            : opts.strongEyeColor
          : phraseIndices[i] % 2 === 0
            ? opts.weakEyeColor
            : opts.strongEyeColor;
    ctx.fillStyle = color;
    ctx.fillText(word, x, y);
    x += wordWidth + spaceWidth;
    wordsOnLine++;
  });
}

// --- Anaglyph compositing --------------------------------------------------

/**
 * `leftCanvas`/`rightCanvas` must already be color-restricted to their own
 * channel (drawSinusoidalGrating/drawRDK color:'red'|'cyan', etc). Screen
 * blend on a black backdrop is the standard anaglyph combination — bright
 * areas of each channel-limited source add together instead of occluding.
 */
export function compositeAnaglyph(
  leftCanvas: OffscreenCanvas | HTMLCanvasElement,
  rightCanvas: OffscreenCanvas | HTMLCanvasElement,
  outputCtx: CanvasRenderingContext2D,
): void {
  const { width, height } = outputCtx.canvas;
  outputCtx.save();
  outputCtx.globalCompositeOperation = 'source-over';
  outputCtx.fillStyle = '#000000';
  outputCtx.fillRect(0, 0, width, height);
  outputCtx.drawImage(leftCanvas as CanvasImageSource, 0, 0);
  outputCtx.globalCompositeOperation = 'screen';
  outputCtx.drawImage(rightCanvas as CanvasImageSource, 0, 0);
  outputCtx.restore();
}

// --- Gaussian aperture mask -------------------------------------------------

/** Fades existing canvas content toward transparent using a circular Gaussian falloff. */
export function applyGaussianAperture(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  sigmaPx: number,
): void {
  const { width, height } = ctx.canvas;
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d')!;
  const imageData = maskCtx.createImageData(width, height);
  const twoSigmaSq = 2 * sigmaPx * sigmaPx;
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const dx = px - centerX;
      const dy = py - centerY;
      const g = Math.exp(-(dx * dx + dy * dy) / twoSigmaSq);
      imageData.data[(py * width + px) * 4 + 3] = Math.round(g * 255);
    }
  }
  maskCtx.putImageData(imageData, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.restore();
}

// --- Random dot stereogram --------------------------------------------------

function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RDSOptions {
  disparityPx: number;
  targetRegionRadius: number;
  targetPosition: 'tl' | 'tr' | 'bl' | 'br';
  eye: 'left' | 'right';
  /** Shared between left/right calls so both halves render the same base dot field. */
  seed?: number;
}

function targetPositionToXY(
  pos: RDSOptions['targetPosition'],
  width: number,
  height: number,
): { x: number; y: number } {
  const marginX = width * 0.25;
  const marginY = height * 0.25;
  switch (pos) {
    case 'tl':
      return { x: marginX, y: marginY };
    case 'tr':
      return { x: width - marginX, y: marginY };
    case 'bl':
      return { x: marginX, y: height - marginY };
    case 'br':
      return { x: width - marginX, y: height - marginY };
  }
}

/**
 * Renders one eye's half of a random-dot stereogram. Call twice with the
 * same `seed` (eye: 'left' then eye: 'right') to produce a matched pair —
 * the target region's dots are shifted by `disparityPx` only for the right
 * eye, which is what makes the region pop out in depth once fused.
 */
export function drawRDS(ctx: CanvasRenderingContext2D, opts: RDSOptions): void {
  const { width, height } = ctx.canvas;
  const rand = mulberry32(opts.seed ?? 42);
  const dotRadius = 2;
  const density = 0.5;
  const cellSize = dotRadius * 2;
  const target = targetPositionToXY(opts.targetPosition, width, height);

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, width, height);

  for (let y = 0; y < height; y += cellSize) {
    for (let x = 0; x < width; x += cellSize) {
      const present = rand() < density;
      const isBlack = rand() < 0.5;
      const jitterX = rand() * cellSize * 0.4;
      const jitterY = rand() * cellSize * 0.4;
      if (!present) continue;

      const dx = x - target.x;
      const dy = y - target.y;
      const inTarget = dx * dx + dy * dy <= opts.targetRegionRadius * opts.targetRegionRadius;
      const drawX = inTarget && opts.eye === 'right' ? x + opts.disparityPx : x;

      ctx.fillStyle = isBlack ? '#000000' : '#FFFFFF';
      ctx.beginPath();
      ctx.arc(drawX + jitterX, y + jitterY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
