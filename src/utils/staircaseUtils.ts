import type { StaircaseConfig, StaircaseState } from '../types/staircase';

/**
 * Pure-function up/down staircase + a simplified Bayesian ("quest_plus") mode.
 * No React, no side effects — wrapped by hooks/useStaircase.ts.
 */

const REVERSALS_AVERAGED = 4;

export function initStaircaseState(config: StaircaseConfig): StaircaseState {
  return {
    currentValue: config.startValue,
    reversals: [],
    responses: [],
    threshold: null,
    complete: false,
  };
}

// Run-length tracking isn't kept in StaircaseState (which mirrors the spec's
// shape exactly) — it's recomputed from `responses` + rule on every step so
// the state object stays serializable and matches the spec's StaircaseState.
function stepsToReverse(type: StaircaseConfig['type']): number {
  return type === '3down1up' ? 3 : 2; // 2down1up and quest_plus both step down on 2 correct
}

function nextValue(
  value: number,
  direction: 'up' | 'down',
  step: number,
  config: StaircaseConfig,
): number {
  const raw = config.logScale
    ? direction === 'down'
      ? value * Math.pow(10, -step)
      : value * Math.pow(10, step)
    : direction === 'down'
      ? value - step
      : value + step;
  return Math.min(config.maxValue, Math.max(config.minValue, raw));
}

/**
 * Applies one trial response to the staircase and returns the new state.
 * `correct` — did the response match the up/down rule's "success" criterion
 * (e.g. correct discrimination, or "fused" report for the fusion staircase).
 */
export function stepStaircase(
  config: StaircaseConfig,
  state: StaircaseState,
  correct: boolean,
): StaircaseState {
  if (state.complete) return state;

  const responses = [...state.responses, correct];
  const downRunNeeded = stepsToReverse(config.type);

  // Determine consecutive-correct streak since the last incorrect response.
  let streak = 0;
  for (let i = responses.length - 1; i >= 0; i--) {
    if (responses[i]) streak++;
    else break;
  }

  let direction: 'up' | 'down' | null = null;
  if (!correct) {
    direction = 'up';
  } else if (streak >= downRunNeeded && streak % downRunNeeded === 0) {
    direction = 'down';
  }

  let currentValue = state.currentValue;
  let reversals = state.reversals;

  if (direction) {
    const priorDirection = inferLastDirection(state, config);
    const step =
      state.reversals.length === 0 ? config.stepSize : config.stepSizeAfterReversal;
    currentValue = nextValue(state.currentValue, direction, step, config);

    if (priorDirection && priorDirection !== direction) {
      reversals = [...state.reversals, state.currentValue];
    }
  }

  const complete = reversals.length >= config.minReversals;
  const threshold = complete ? meanOfLastReversals(reversals) : null;

  return { currentValue, reversals, responses, threshold, complete };
}

// Reconstructs whether the last non-null move was 'up' or 'down' purely from
// the reversal count parity + current trend, since StaircaseState doesn't
// store direction directly (kept minimal per the spec's type).
function inferLastDirection(
  state: StaircaseState,
  config: StaircaseConfig,
): 'up' | 'down' | null {
  if (state.reversals.length === 0) return null;
  // Even number of reversals so far means the trend since the last reversal
  // matches the *first* ever direction; odd means it's flipped. We recover
  // the first direction from whether value at reversal 1 was above or below
  // the start value.
  const firstReversalValue = state.reversals[0];
  const firstDirection: 'up' | 'down' =
    firstReversalValue < config.startValue ? 'down' : 'up';
  const flips = state.reversals.length - 1;
  return flips % 2 === 0 ? firstDirection : firstDirection === 'down' ? 'up' : 'down';
}

function meanOfLastReversals(reversals: number[]): number {
  const tail = reversals.slice(-REVERSALS_AVERAGED);
  return tail.reduce((sum, v) => sum + v, 0) / tail.length;
}

// --- Simplified Bayesian (QUEST+-style) single-parameter staircase ---
// Used where a full multi-dimensional QUEST+ (see questPlus.ts, CSFTest)
// isn't needed — just a faster-converging 1D threshold estimate than
// classic up/down, still expressed through the same StaircaseState shape.

export interface BayesianPosterior {
  grid: number[]; // candidate threshold values
  weights: number[]; // posterior probability per grid point, sums to 1
}

const SLOPE = 3.5; // Weibull psychometric function slope, fixed and typical for detection tasks
const GUESS_RATE = 0.5; // 2AFC-equivalent default; callers using nAFC>2 should treat this as a floor

function weibullP(x: number, threshold: number, guessRate: number): number {
  if (threshold <= 0) return guessRate;
  const ratio = x / threshold;
  return guessRate + (1 - guessRate) * (1 - Math.exp(-Math.pow(Math.max(ratio, 1e-6), SLOPE)));
}

export function initBayesianPosterior(config: StaircaseConfig, steps = 40): BayesianPosterior {
  const grid: number[] = [];
  for (let i = 0; i < steps; i++) {
    const t = config.minValue + ((config.maxValue - config.minValue) * i) / (steps - 1);
    grid.push(t);
  }
  return { grid, weights: grid.map(() => 1 / grid.length) };
}

export function updateBayesianPosterior(
  posterior: BayesianPosterior,
  presentedValue: number,
  correct: boolean,
  guessRate = GUESS_RATE,
): BayesianPosterior {
  const likelihoods = posterior.grid.map((threshold) => {
    const p = weibullP(presentedValue, threshold, guessRate);
    return correct ? p : 1 - p;
  });
  const unnormalized = posterior.weights.map((w, i) => w * likelihoods[i]);
  const total = unnormalized.reduce((s, v) => s + v, 0) || 1;
  return { grid: posterior.grid, weights: unnormalized.map((v) => v / total) };
}

export function posteriorMean(posterior: BayesianPosterior): number {
  return posterior.grid.reduce((sum, v, i) => sum + v * posterior.weights[i], 0);
}

/** Picks the next stimulus value as the grid point closest to the current posterior mean. */
export function nextBayesianValue(posterior: BayesianPosterior): number {
  const mean = posteriorMean(posterior);
  return posterior.grid.reduce((best, v) =>
    Math.abs(v - mean) < Math.abs(best - mean) ? v : best,
  );
}

export function posteriorEntropy(posterior: BayesianPosterior): number {
  return -posterior.weights.reduce((sum, w) => sum + (w > 0 ? w * Math.log2(w) : 0), 0);
}
