/**
 * Grid-based Bayesian adaptive procedure for stereoacuity, in the same
 * style as questPlus.ts's CSF fit. Uses the standard 4-parameter
 * psychometric function (Wichmann & Hill, 2001, "The psychometric
 * function: I. Fitting, sampling and goodness of fit"):
 *
 *   P(correct) = guessRate + (1 - guessRate - lapseRate) * F(x; threshold, slope)
 *
 * with guessRate fixed at 0.25 (4-AFC quadrant task) and F a logistic
 * function of log10(disparity). Unlike a classic up/down staircase, the
 * lapse rate is an explicit free parameter the posterior fits alongside
 * threshold — not folded into "just guess when unsure." That's what lets
 * the procedure tell "this person's threshold is near the display's
 * largest disparity" apart from "this person can't reliably do the task
 * at all," and stop early on the latter instead of grinding through a
 * fixed trial count a stereo-blind participant has no chance of passing.
 */

export interface StereoModelParams {
  logThreshold: number; // log10(arcsec) at ~75%-ish performance
  lapseRate: number;
}

export interface StereoPosterior {
  params: StereoModelParams[];
  weights: number[]; // sums to 1
}

const CHANCE = 0.25; // 4AFC quadrant task
const SLOPE = 3; // fixed logistic slope in log10-disparity space — a simplification, not a fitted parameter (same treatment questPlus.ts gives its SLOPE)

function linspace(min: number, max: number, n: number): number[] {
  if (n === 1) return [min];
  return Array.from({ length: n }, (_, i) => min + ((max - min) * i) / (n - 1));
}

// Threshold grid spans past the largest clinically tested disparity (800
// arcsec) so "no measurable stereopsis" has somewhere to live in the model
// rather than being clipped at the edge of the testable range.
const LOG_THRESHOLD_GRID = linspace(Math.log10(15), Math.log10(1600), 16);
const LAPSE_GRID = [0, 0.05, 0.1, 0.2, 0.35, 0.5];
// A flat prior over both threshold AND lapse rate is a known problem here:
// chance-level responses are explained equally well by "no real threshold
// within range" (large logThreshold) or by "fine threshold, but lapses
// half the time" (small logThreshold, large lapseRate) — the two trade off
// and neither converges. Prins (2012, "The psychometric function: The
// lapse rate revisited," Journal of Vision) is the standard citation for
// this specific non-identifiability, and the standard fix is an
// informative prior favoring small lapse rates a priori (true "randomly
// unable to attend to the task on half the trials" is rare) so chance-level
// data gets attributed to threshold, not lapse.
const LAPSE_PRIOR_WEIGHTS = [0.4, 0.25, 0.15, 0.1, 0.06, 0.04]; // same order as LAPSE_GRID, sums to 1

// Below this much data, don't trust the posterior enough to stop early —
// a lucky or unlucky run of 2-3 trials shouldn't end the test.
export const MIN_TRIALS = 6;
// Safety net: stop regardless of convergence once reached. Matches the old
// fixed-trial-count test's length for participants with measurable
// stereopsis (their posterior keeps improving slowly past this point given
// only 7 discrete disparity levels to present, not enough to justify a
// longer session) — the entire point of the adaptive procedure is to
// finish *earlier* than this for a no-stereopsis participant, not to run
// longer for anyone.
export const MAX_TRIALS = 20;
// Entropy (bits) of the *marginal* posterior over threshold alone (lapse
// summed out — see marginalThresholdEntropy) below which the threshold
// estimate is confident enough to stop. Max possible is log2(16) = 4.0
// bits (uniform); this is a tuned convergence criterion, not a value from
// the literature. Using the marginal instead of the joint (threshold +
// lapse) entropy matters: lapse rate stays weakly identified far longer
// than threshold does (that's the Prins 2012 problem again), so requiring
// the *joint* posterior to converge means never stopping early even once
// the threshold itself is well pinned down.
export const ENTROPY_STOP_BITS = 1.8;
// Posterior probability mass on "threshold at/beyond the largest tested
// disparity" required to call the test early as no measurable stereopsis.
export const NO_STEREOPSIS_PROBABILITY = 0.7;

function pCorrect(logDisparity: number, p: StereoModelParams): number {
  const f = 1 / (1 + Math.exp(-SLOPE * (logDisparity - p.logThreshold)));
  return CHANCE + (1 - CHANCE - p.lapseRate) * f;
}

export function initStereoPosterior(): StereoPosterior {
  const params: StereoModelParams[] = [];
  const weights: number[] = [];
  for (const logThreshold of LOG_THRESHOLD_GRID) {
    LAPSE_GRID.forEach((lapseRate, j) => {
      params.push({ logThreshold, lapseRate });
      weights.push(LAPSE_PRIOR_WEIGHTS[j] / LOG_THRESHOLD_GRID.length);
    });
  }
  const total = weights.reduce((s, w) => s + w, 0);
  return { params, weights: weights.map((w) => w / total) };
}

/** Picks the candidate disparity whose predicted response is most uncertain under the current posterior. */
export function selectNextStereoStimulus(
  posterior: StereoPosterior,
  candidatesArcsec: number[],
): number {
  let best = candidatesArcsec[0];
  let bestEntropy = -Infinity;
  for (const arcsec of candidatesArcsec) {
    const logD = Math.log10(arcsec);
    let pAvg = 0;
    for (let i = 0; i < posterior.params.length; i++) {
      pAvg += posterior.weights[i] * pCorrect(logD, posterior.params[i]);
    }
    const p = Math.min(0.999, Math.max(0.001, pAvg));
    const entropy = -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
    if (entropy > bestEntropy) {
      bestEntropy = entropy;
      best = arcsec;
    }
  }
  return best;
}

export function updateStereoPosterior(
  posterior: StereoPosterior,
  presentedArcsec: number,
  correct: boolean,
): StereoPosterior {
  const logD = Math.log10(presentedArcsec);
  const likelihoods = posterior.params.map((p) => {
    const pc = pCorrect(logD, p);
    return correct ? pc : 1 - pc;
  });
  const unnormalized = posterior.weights.map((w, i) => w * likelihoods[i]);
  const total = unnormalized.reduce((s, v) => s + v, 0) || 1;
  return { params: posterior.params, weights: unnormalized.map((v) => v / total) };
}

export function meanLogThreshold(posterior: StereoPosterior): number {
  return posterior.params.reduce((sum, p, i) => sum + p.logThreshold * posterior.weights[i], 0);
}

export function meanLapseRate(posterior: StereoPosterior): number {
  return posterior.params.reduce((sum, p, i) => sum + p.lapseRate * posterior.weights[i], 0);
}

export function posteriorEntropy(posterior: StereoPosterior): number {
  return -posterior.weights.reduce((sum, w) => sum + (w > 0 ? w * Math.log2(w) : 0), 0);
}

/** Entropy (bits) of the posterior over threshold alone, with lapse rate summed out — see the ENTROPY_STOP_BITS comment for why this, not the joint entropy, is the right stopping signal. */
export function marginalThresholdEntropy(posterior: StereoPosterior): number {
  const byThreshold = new Map<number, number>();
  posterior.params.forEach((p, i) => {
    byThreshold.set(p.logThreshold, (byThreshold.get(p.logThreshold) ?? 0) + posterior.weights[i]);
  });
  let entropy = 0;
  for (const w of byThreshold.values()) {
    if (w > 0) entropy -= w * Math.log2(w);
  }
  return entropy;
}

/** Posterior probability that the true threshold is at or beyond `maxTestedArcsec` — i.e. undetectable even at the easiest tested level. */
export function probabilityNoStereopsis(posterior: StereoPosterior, maxTestedArcsec: number): number {
  const logMax = Math.log10(maxTestedArcsec);
  let mass = 0;
  posterior.params.forEach((p, i) => {
    if (p.logThreshold >= logMax) mass += posterior.weights[i];
  });
  return mass;
}
