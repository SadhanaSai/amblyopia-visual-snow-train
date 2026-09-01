/**
 * Simplified QUEST+ for CSFTest: a grid-based Bayesian adaptive procedure
 * that fits a 3-parameter truncated log-parabola CSF model (peak gain,
 * peak spatial frequency, bandwidth) across trials, selecting the
 * (spatial frequency, contrast) pair on each trial that maximizes expected
 * information about the posterior — no external psychophysics library.
 */

export interface CSFModelParams {
  peakGain: number; // log10 sensitivity at the peak
  peakSf: number; // cpd
  bandwidth: number; // octaves, controls curve width
}

export interface CSFPosterior {
  params: CSFModelParams[];
  weights: number[]; // sums to 1
}

export interface CSFStimulus {
  sf: number; // cpd
  contrastPct: number; // 0.5-100 Michelson
}

export const CSF_SPATIAL_FREQUENCIES = [1, 2, 4, 8, 16];
const CONTRAST_LEVELS_PCT = [0.5, 1, 2, 4, 8, 16, 32, 64, 100];
const CHANCE = 0.25; // 4AFC orientation task
const SLOPE = 3;

function linspace(min: number, max: number, n: number): number[] {
  if (n === 1) return [min];
  return Array.from({ length: n }, (_, i) => min + ((max - min) * i) / (n - 1));
}

function logspace(min: number, max: number, n: number): number[] {
  return linspace(Math.log10(min), Math.log10(max), n).map((v) => Math.pow(10, v));
}

const PEAK_GAIN_GRID = linspace(0.5, 2.5, 6);
const PEAK_SF_GRID = logspace(1, 8, 5);
const BANDWIDTH_GRID = linspace(1, 4, 4);

function logCS(sf: number, p: CSFModelParams): number {
  const octaves = Math.log2(sf / p.peakSf);
  return p.peakGain - (4 * Math.LN2 * octaves * octaves) / (p.bandwidth * p.bandwidth);
}

function thresholdContrast(sf: number, p: CSFModelParams): number {
  return Math.pow(10, -logCS(sf, p));
}

function pCorrect(contrast: number, sf: number, p: CSFModelParams): number {
  const ratio = contrast / thresholdContrast(sf, p);
  return CHANCE + (1 - CHANCE) * (1 - Math.exp(-Math.pow(Math.max(ratio, 1e-6), SLOPE)));
}

export function initCSFPosterior(): CSFPosterior {
  const params: CSFModelParams[] = [];
  for (const peakGain of PEAK_GAIN_GRID) {
    for (const peakSf of PEAK_SF_GRID) {
      for (const bandwidth of BANDWIDTH_GRID) {
        params.push({ peakGain, peakSf, bandwidth });
      }
    }
  }
  return { params, weights: params.map(() => 1 / params.length) };
}

/** Picks the (sf, contrast) pair whose predicted response is most uncertain under the current posterior. */
export function selectNextCSFStimulus(posterior: CSFPosterior): CSFStimulus {
  let best: CSFStimulus = { sf: CSF_SPATIAL_FREQUENCIES[0], contrastPct: CONTRAST_LEVELS_PCT[0] };
  let bestEntropy = -Infinity;
  for (const sf of CSF_SPATIAL_FREQUENCIES) {
    for (const contrastPct of CONTRAST_LEVELS_PCT) {
      const contrast = contrastPct / 100;
      let pAvg = 0;
      for (let i = 0; i < posterior.params.length; i++) {
        pAvg += posterior.weights[i] * pCorrect(contrast, sf, posterior.params[i]);
      }
      const p = Math.min(0.999, Math.max(0.001, pAvg));
      const entropy = -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
      if (entropy > bestEntropy) {
        bestEntropy = entropy;
        best = { sf, contrastPct };
      }
    }
  }
  return best;
}

export function updateCSFPosterior(
  posterior: CSFPosterior,
  stimulus: CSFStimulus,
  correct: boolean,
): CSFPosterior {
  const contrast = stimulus.contrastPct / 100;
  const likelihoods = posterior.params.map((p) => {
    const pc = pCorrect(contrast, stimulus.sf, p);
    return correct ? pc : 1 - pc;
  });
  const unnormalized = posterior.weights.map((w, i) => w * likelihoods[i]);
  const total = unnormalized.reduce((s, v) => s + v, 0) || 1;
  return { params: posterior.params, weights: unnormalized.map((v) => v / total) };
}

export function meanCSFParams(posterior: CSFPosterior): CSFModelParams {
  const acc = { peakGain: 0, peakSf: 0, bandwidth: 0 };
  posterior.params.forEach((p, i) => {
    acc.peakGain += p.peakGain * posterior.weights[i];
    acc.peakSf += p.peakSf * posterior.weights[i];
    acc.bandwidth += p.bandwidth * posterior.weights[i];
  });
  return acc;
}

export function sensitivityAtFrequencies(params: CSFModelParams, sfs: number[]): number[] {
  return sfs.map((sf) => Math.pow(10, logCS(sf, params)));
}

/** Area under log sensitivity vs log spatial frequency (trapezoidal). */
export function computeAULCSF(sensitivities: number[], sfs: number[]): number {
  let area = 0;
  for (let i = 1; i < sfs.length; i++) {
    const x0 = Math.log10(sfs[i - 1]);
    const x1 = Math.log10(sfs[i]);
    const y0 = Math.log10(Math.max(sensitivities[i - 1], 1e-6));
    const y1 = Math.log10(Math.max(sensitivities[i], 1e-6));
    area += ((y0 + y1) / 2) * (x1 - x0);
  }
  return area;
}
