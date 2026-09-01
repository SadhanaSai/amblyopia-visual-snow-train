# Dichoptic Training + NOPT Web App — Full Claude Code Spec

## Overview

A two-module clinical-grade home vision training web app for:
- **Phase 1:** Dichoptic training for diagnosed amblyopia (lazy eye)
- **Phase 2:** NOPT / VSS exercises for Visual Snow Syndrome

Built for personal use. All exercises grounded in peer-reviewed research published 2020–2025.

---

## Stack

```
React 18 + TypeScript (Vite)
Tailwind CSS (utility classes only, no component libraries)
Canvas API for all stimulus rendering (no WebGL)
localStorage for session and profile persistence
No UI component libraries — all primitives hand-coded
No charting libraries — all charts canvas-rendered
```

---

## File Structure

```
/src
  /onboarding
    OnboardingWizard.tsx
    ContraindicationCheck.tsx

  /profile
    ProfileContext.tsx
    ProfileSettings.tsx

  /calibration
    CalibrationWizard.tsx        # banknote / paper sizing flow
    useViewingCalibration.ts     # ppmm calculation, storage, recal prompts

  /assessment
    VATest.tsx                   # logMAR visual acuity
    CSFTest.tsx                  # contrast sensitivity function (QUEST+)
    StereoTest.tsx               # stereoacuity via random-dot stereogram
    AssessmentRouter.tsx         # weekly/biweekly prompt logic

  /dichoptic
    GratingFusion.tsx
    LetterDiscrimination.tsx
    RivalryProbe.tsx
    MotionCoherence.tsx
    DichopticReading.tsx
    FixationStability.tsx
    ICRController.tsx

  /nopt
    NoiseAdaptation.tsx
    SaccadicTraining.tsx
    VergenceTraining.tsx
    EntopticDesensitization.tsx
    ChromaticSimulator.tsx

  /progress
    ProgressDashboard.tsx
    VAChart.tsx
    CSFChart.tsx
    SuppressionChart.tsx
    StereoChart.tsx
    ComplianceHeatmap.tsx

  /hooks
    useSessionLogger.ts
    useCanvasRenderer.ts
    useStaircase.ts              # 2-down-1-up, 3-down-1-up, QUEST+ variants
    useAdaptiveICR.ts
    useTimer.ts
    useViewingCalibration.ts

  /utils
    canvasUtils.ts               # all stimulus rendering primitives
    staircaseUtils.ts
    profileUtils.ts
    colorUtils.ts                # ICR blending, anaglyph channel separation

  /types
    session.ts
    exercise.ts
    profile.ts
    staircase.ts
    assessment.ts

  /data
    readingCorpus.ts             # 30 passages with comprehension questions
    milestones.ts

  App.tsx                        # tab router
```

---

## Build Order for Claude Code

```
1.  /types — all interfaces first, no dependencies
2.  /utils/staircaseUtils.ts — pure math, no React
3.  /utils/canvasUtils.ts — all stimulus primitives
4.  /utils/colorUtils.ts — ICR blending, channel compositing
5.  /hooks/useStaircase.ts — wraps staircaseUtils
6.  /hooks/useSessionLogger.ts
7.  /hooks/useTimer.ts
8.  /hooks/useViewingCalibration.ts
9.  /calibration/CalibrationWizard.tsx
10. /onboarding/OnboardingWizard.tsx + ContraindicationCheck.tsx
11. /profile/ProfileContext.tsx + ProfileSettings.tsx
12. /hooks/useAdaptiveICR.ts + /dichoptic/ICRController.tsx
13. /assessment/VATest.tsx
14. /assessment/CSFTest.tsx
15. /assessment/StereoTest.tsx
16. /assessment/AssessmentRouter.tsx
17. Phase 1 exercises (order below)
18. Phase 2 exercises (order below)
19. /progress/* — all chart components
20. App.tsx tab router + final integration
```

---

## Onboarding

4-screen wizard. Blocks all app content until complete. Cannot be skipped.

```
Screen 1 — Weak eye selection
  Diagram of face with left/right eye labeled
  User taps: Left eye is weaker / Right eye is weaker
  Stored in profile as weakEye: 'left' | 'right'

Screen 2 — Diagnosis type
  Options:
    Anisometropic amblyopia (different prescriptions between eyes)
    Strabismic amblyopia (eye turn / misalignment)
    Combined mechanism
    Diagnosed but type not specified
  Stored as diagnosis: 'anisometropic' | 'strabismic' | 'combined' | 'unspecified'
  Note: Strabismic → enables FixationStability exercise
        Anisometropic only → FixationStability marked not applicable

Screen 3 — Contraindications
  Checkbox required for each:
    [ ] I do not have photosensitive epilepsy
        (photopsia desensitization module locked if unchecked)
    [ ] I have not had strabismus surgery in the past 6 months
    [ ] I will stop immediately if I experience double vision, headache, or nausea
    [ ] I understand this app does not replace clinical care
  All four must be checked to proceed

Screen 4 — Protocol overview
  Brief explanation of dichoptic training mechanism
  Recommended schedule: 5 days/week, starting at 5 min/session
  Link to Guide tab for full explanation
  "Start calibration" button → triggers CalibrationWizard before first session
```

---

## Screen Calibration

Required before first assessment or exercise. Re-prompted every 4 weeks or on device change.

```
Component: CalibrationWizard.tsx
Hook: useViewingCalibration.ts

Step 1 — Select reference object
  Currency / paper selector:

  [US Dollar] [Indian Rupee ▾] [Euro] [UK Pound] [A4 Paper] [US Letter]

  Indian Rupee sub-selector (shown when INR chosen):
    ₹10  → 123mm
    ₹20  → 129mm
    ₹50  → 135mm
    ₹100 → 142mm
    ₹200 → 146mm
    ₹500 → 150mm
    ₹2000 → 166mm (note: withdrawn May 2023 but legal tender, kept in list)

  Reference widths (long edge used for matching):
    USD:        156.1mm (all denominations, unchanged since 1928)
    EUR:        120.0mm (€5–€50 Europa series 2013+)
    GBP:        125.0mm (£5 polymer 2016+)
    A4:         210.0mm
    US Letter:  215.9mm

Step 2 — Physical alignment
  App renders a horizontal rectangle of the reference width
  Instruction: "Place your [note/paper] flat against the screen, long edge horizontal"
  User adjusts slider until on-screen rectangle matches physical object exactly
  Slider: 1px step granularity, real-time rectangle update
  Range: 300px to 2000px (covers 72–300 PPI screens)

Step 3 — Confirmation
  Derived PPI shown: "Your screen is approximately X PPI"
  Sanity check ranges displayed: typical laptop 96–227 PPI, 4K monitor 163–220 PPI
  Warning shown if result is outside 60–350 PPI range (likely misalignment)
  User can redo or confirm

Step 4 — Viewing distance
  Instruction: "Sit so your eyes are 40cm from the screen"
  Printable 40cm string guide offered (renders a ruler graphic to print)
  User confirms distance with checkbox

Output stored in profile:
  ppmm: number
  referenceObject: string
  inrDenomination?: number
  calibratedAt: ISO8601
  viewingDistanceMm: 400 (fixed)

useViewingCalibration.ts exports:
  ppmm: number
  degToPx(degrees): number      # converts visual angle to pixels
  mmToPx(mm): number
  isCalibrated: boolean
  daysSinceCalibration: number
```

---

## Types

```typescript
// profile.ts
interface UserProfile {
  weakEye: 'left' | 'right';
  diagnosis: 'anisometropic' | 'strabismic' | 'combined' | 'unspecified';
  photosensitiveEpilepsy: boolean;
  strabismusSurgeryRecent: boolean;
  clinicianConsulted: boolean;
  onboardingComplete: boolean;
  calibration: CalibrationData;
  createdAt: string;
}

interface CalibrationData {
  ppmm: number;
  referenceObject: string;
  inrDenomination?: number;
  calibratedAt: string;
  viewingDistanceMm: number;
}

// session.ts
interface Session {
  id: string;
  timestamp: string;
  module: 'dichoptic' | 'nopt' | 'assessment';
  exercise: string;
  paradigm?: string;
  displayMode?: DisplayMode;
  weakEye: 'left' | 'right';
  durationSeconds: number;
  trials: number;
  accuracy?: number;
  staircaseThreshold?: number;
  thresholdUnit?: string;
  icrUsed?: number;
  selfRating?: { pre: number; post: number };
  adaptationReliefDuration?: number;
  notes?: string;
}

// assessment.ts
interface VAResult {
  date: string;
  logMAR: number;
  lettersCorrectPerRow: Record<string, number>;
  eye: 'weak' | 'strong';
  ppmm: number;
}

interface CSFResult {
  date: string;
  eye: 'weak' | 'strong';
  sf_1cpd: number;
  sf_2cpd: number;
  sf_4cpd: number;
  sf_8cpd: number;
  sf_16cpd: number;
  AULCSF: number;
}

interface StereoResult {
  date: string;
  thresholdArcsec: number;
  logThreshold: number;
}

interface SuppressionResult {
  date: string;
  thresholdContrastPct: number;
}

// staircase.ts
type StaircaseType = '2down1up' | '3down1up' | 'quest_plus';

interface StaircaseConfig {
  type: StaircaseType;
  startValue: number;
  stepSize: number;
  stepSizeAfterReversal: number;
  minReversals: number;
  minValue: number;
  maxValue: number;
  logScale: boolean;
}

interface StaircaseState {
  currentValue: number;
  reversals: number[];
  responses: boolean[];
  threshold: number | null;
  complete: boolean;
}

// exercise.ts
type DisplayMode = 'anaglyph' | 'side_by_side' | 'screen_only';

interface ExerciseSettings {
  displayMode: DisplayMode;
  icr: number;
  durationMinutes: number;
  speed: number;
}
```

---

## Hooks

### useStaircase.ts

```typescript
// Implements 2-down-1-up, 3-down-1-up, and QUEST+ (simplified Bayesian)
// 2-down-1-up targets 70.7% correct threshold
// 3-down-1-up targets 79.4% correct threshold
// QUEST+ used for CSFTest — Bayesian adaptive, maximizes information per trial

export function useStaircase(config: StaircaseConfig): {
  currentValue: number;
  respond: (correct: boolean) => void;
  state: StaircaseState;
  reset: () => void;
}
```

### useAdaptiveICR.ts

```typescript
// Tracks ICR across sessions, not within a single staircase
// After each session: if threshold ICR increased → bump ICR up 0.05
// If threshold stable across 3 sessions → hold
// If threshold dropped → flag, hold ICR
// ICR range: 0.1 to 1.0
// Exposed to user as "Balance level 1–10" (not raw decimal)

export function useAdaptiveICR(): {
  currentICR: number;
  balanceLevel: number;          // 1–10 display value
  updateFromSession: (thresholdICR: number) => void;
  trend: 'improving' | 'stable' | 'regressing';
}
```

### useSessionLogger.ts

```typescript
// Unified store for all sessions and assessments
// Persists to localStorage under keys:
//   'sessions' → Session[]
//   'va_results' → VAResult[]
//   'csf_results' → CSFResult[]
//   'stereo_results' → StereoResult[]
//   'suppression_results' → SuppressionResult[]

export function useSessionLogger(): {
  logSession: (s: Session) => void;
  logVA: (r: VAResult) => void;
  logCSF: (r: CSFResult) => void;
  logStereo: (r: StereoResult) => void;
  logSuppression: (r: SuppressionResult) => void;
  sessions: Session[];
  vaResults: VAResult[];
  csfResults: CSFResult[];
  stereoResults: StereoResult[];
  suppressionResults: SuppressionResult[];
}
```

---

## Utils

### canvasUtils.ts — all stimulus primitives

```typescript
// Grating
drawSinusoidalGrating(ctx, {
  spatialFrequencyCpd: number,
  contrast: number,              // 0–1 Michelson
  orientation: number,           // degrees
  phase: number,
  apertureSigmaPx: number,       // Gaussian window sigma
  color: 'luminance' | 'red' | 'cyan'
}): void

// Random dot kinematogram
createRDK(config: {
  nDots: number,
  coherence: number,             // 0–1
  directionDeg: number,
  speedDegPerSec: number,
  dotLifetimeFrames: number,
  fieldDiameterPx: number,
  dotRadiusPx: number,
  eye: 'weak' | 'strong' | 'both',
  icr: number
}): RDKState

stepRDK(state: RDKState, deltaTime: number): RDKState
drawRDK(ctx, state: RDKState): void

// Sloan optotypes — vector drawn, not system font
drawSloanLetter(ctx, letter: string, {
  centerX: number,
  centerY: number,
  sizePx: number,                // letter height
  color: string
}): void

// Dichoptic text rendering
renderDichopticText(ctx, passage: string, {
  mode: 'word' | 'line' | 'phrase',
  weakEyeColor: string,          // full red '#FF0000' for weak eye
  strongEyeColor: string,        // ICR-blended cyan for strong eye
  canvasWidth: number,
  lineHeight: number,
  fontSize: number,
  fontFamily: string
}): void

// Anaglyph compositing
compositeAnaglyph(
  leftCanvas: OffscreenCanvas,   // red channel (weak eye if weak=left)
  rightCanvas: OffscreenCanvas,  // cyan channel
  outputCtx: CanvasRenderingContext2D
): void

// Gaussian aperture mask
applyGaussianAperture(ctx, centerX, centerY, sigmaPx): void

// Random dot stereogram (for StereoTest)
drawRDS(ctx, {
  disparityPx: number,
  targetRegionRadius: number,
  targetPosition: 'tl' | 'tr' | 'bl' | 'br',
  eye: 'left' | 'right'
}): void
```

### colorUtils.ts

```typescript
// Apply ICR: blends strongEye color toward white background
// Weak eye always receives full-saturation color
applyICR(baseColor: [number,number,number], icr: number): string

// Returns red hex for weak eye, ICR-blended cyan for strong eye
// based on user profile weakEye setting
getDichopticColors(weakEye: 'left' | 'right', icr: number): {
  leftEyeColor: string,
  rightEyeColor: string
}
```

---

## Calibration-Dependent Conversions

All stimulus sizes specified in degrees of visual angle or arc-seconds. Converted to pixels at render time using ppmm from calibration.

```typescript
// In useViewingCalibration.ts:
degToPx(deg: number): number {
  const distanceMm = 400; // fixed 40cm
  return Math.tan(deg * Math.PI / 180) * distanceMm * ppmm;
}

arcSecToPx(arcsec: number): number {
  return degToPx(arcsec / 3600);
}

mmToPx(mm: number): number {
  return mm * ppmm;
}
```

---

## Assessment Module

### Assessment 1: Visual Acuity (logMAR) — VATest.tsx

**Research basis:** DigiVis validation study (*Eye*, 2021) — web-based VA bias of −0.001 logMAR vs. gold standard, ICC 0.922. COMPlog home VA study — no significant bias vs. in-clinic at mean −0.01 logMAR.

**Frequency:** Weekly prompt from AssessmentRouter

```
Optotypes: Sloan letters (C D H K N O R S V Z)
  Rendered via drawSloanLetter() in canvasUtils
  5 letters per row

logMAR rows presented:
  1.0 → 0.9 → 0.8 → 0.7 → 0.6 → 0.5 → 0.4 → 0.3 → 0.2 → 0.1 → 0.0 → -0.1

Letter height at each logMAR:
  heightPx = degToPx(Math.pow(10, logMAR) / 60 * 5)
  (5 arcmin = 1 letter height at logMAR 0.0)

Procedure:
  Start at 0.5 logMAR
  Present 5 letters, user types each on keyboard
  4/5 correct → pass → move to harder row (lower logMAR)
  2/5 correct → fail → move to easier row (higher logMAR)
  2 consecutive fails → test ends
  Score = smallest row where 4/5 correct
  Maximum ceiling: -0.1 logMAR

Run for weak eye only (strong eye patched or covered)
App shows instruction: "Cover your [strong eye] completely before starting"
User confirms with checkbox before letters appear

Output: VAResult logged via useSessionLogger

Clinical context shown to user:
  logMAR 0.0 = 20/20 (normal)
  logMAR 0.1 = 20/25 (mild reduction)
  logMAR 0.3 = 20/40 (moderate)
  logMAR 0.5 = 20/60 (significant)
  logMAR 1.0 = 20/200 (legal blindness threshold)
  "A 0.1 improvement = 1 line improvement on a clinical chart"
```

### Assessment 2: Contrast Sensitivity Function — CSFTest.tsx

**Research basis:** qCSF method (Lesmes et al., 2010, *JOV*) — distinguishes normal vs. amblyopic CSF in 25 trials. Gamified QUEST+ CSF for amblyopia monitoring validated feasibility for home use (Grieco-Calub et al., 2020, *Front. Med.*).

**Frequency:** Every 2 weeks

```
Algorithm: QUEST+ (simplified Bayesian adaptive)
  Fits truncated log-parabola CSF model with 3 parameters:
    peak_gain, peak_sf, bandwidth
  Each trial: selects (sf, contrast) pair that maximizes expected information
  Implemented in TypeScript — no external psychophysics library

Spatial frequencies: 1, 2, 4, 8, 16 cpd
Contrast range: 0.5% to 100% Michelson
Stimulus: sinusoidal Gabor patch, 45° orientation, 200ms presentation
Task: 4AFC orientation (arrow keys: ↑ ↓ ← →)
  Chance level 25%, threshold targeted at ~75% correct
Total trials: 25 (distributed across frequencies by QUEST+ information gain)
Duration: ~4 minutes

Run separately for weak eye then strong eye
Interocular difference in AULCSF = binocular balance metric

Output: CSFResult logged
AULCSF computed as area under log sensitivity curve across 5 frequencies
```

### Assessment 3: Stereoacuity — StereoTest.tsx

**Research basis:** CureSight 1-year follow-up (AJO, 2024) — stereoacuity improvement of 0.52 log arc-seconds as key outcome. Bynocs adult study — significant stereoacuity improvement sustained 24 months.

**Requires:** Anaglyph display mode. Test locked with explanation if user has no glasses.

**Frequency:** Every 2 weeks (same session as CSF)

```
Stimulus: random-dot stereogram in anaglyph
  Left eye (red channel): random dot field
  Right eye (cyan channel): same field with circular target region
    offset horizontally by disparity D pixels
  Target region: 80px radius circle
  Background: 50% dot density random noise

Disparity levels tested (arc-seconds):
  800, 400, 200, 100, 60, 40, 20
  Converted to pixels: disparityPx = arcSecToPx(arcsec)

Procedure: 4AFC spatial
  Where is the floating circle?
  [ top-left ] [ top-right ] [ bottom-left ] [ bottom-right ]
  Chance = 25%
  2-down-1-up staircase
  20 trials total

Clinical reference lines in progress chart:
  800 arc-sec: gross stereopsis
  200 arc-sec: functional
  60 arc-sec: good
  40 arc-sec: normal

Output: StereoResult logged
```

### Assessment 4: Suppression Depth — from RivalryProbe.tsx

**Dual role:** training exercise AND weekly assessment measure.

```
Run as 5-minute standalone assessment (no staircase training mode)
Strong eye: 90% contrast horizontal grating, continuous
Weak eye: vertical grating probe at variable contrast, 200ms, 3–7s jitter
Task: spacebar when probe visible
Staircase: 2-down-1-up on probe contrast
Output: SuppressionResult { date, thresholdContrastPct }
Clinical meaning: lower threshold = less suppression = treatment working
Progress chart: inverted y-axis (lower = better)
```

### AssessmentRouter.tsx

```
Checks localStorage on each app open:
  VA test: prompts if 7+ days since last
  CSF + Stereo: prompts if 14+ days since last
  Suppression: prompts if 7+ days since last

Prompt shown as non-blocking banner:
  "Time for your weekly vision check — takes 4 minutes"
  [Run now] [Remind me later]
  "Later" snoozes 24 hours, maximum 2 snoozes before mandatory
```

---

## Phase 1: Dichoptic Training

### Display Modes

```typescript
type DisplayMode = 'anaglyph' | 'side_by_side' | 'screen_only'
```

**Anaglyph rendering:**
- Weak eye stimulus rendered to offscreen canvas in red channel only
- Strong eye stimulus rendered to separate offscreen canvas in cyan channel only
- Composited via `compositeAnaglyph()` using `globalCompositeOperation: 'screen'`
- ICR applied to strong eye via `applyICR()` before compositing

**Interocular Contrast Ratio (ICR):**
- Range: 0.1–1.0
- Default: 0.3 (strong eye at 30% of weak eye contrast — per Hess et al. 2010)
- Exposed as "Balance level 1–10" in UI
- Managed cross-session by `useAdaptiveICR`
- Per-exercise staircase threshold feeds back to cross-session ICR update

---

### Exercise 1: Contrast-Defined Grating Fusion

**Research basis:** Hess, Mansouri & Thompson 2010, *Current Biology* — dichoptic grating training reduced suppression and improved binocular function in amblyopia. Vedamurthy et al. 2015, *eLife* — confirmed in adult amblyopia.

```
Stimulus:
  Weak eye: vertical sinusoidal grating, 90°, full contrast (90% Michelson)
  Strong eye: horizontal grating, 0°, ICR × 90% contrast
  Spatial frequency: 1, 2, 4, or 8 cpd (user selects or adaptive)
  Temporal modulation: static | 1Hz counterphase flicker | 4Hz flicker
  Aperture: circular Gaussian window, sigma = degToPx(2°)

Task: after 2000ms stimulus, user reports percept:
  [F] Fused — saw single oblique plaid
  [R] Rivalry — saw alternating patterns
  ISI: 500ms blank gray (#808080)
  Response window: 500ms

Adaptive staircase on ICR:
  2-down-1-up (targets 70.7% fusion rate)
  Step size: 0.05, halved after first reversal
  Minimum 6 reversals, threshold = mean of last 4 reversals

Block: 40 trials (~3 min)
Logged: threshold ICR, % fusion, spatial frequency, temporal condition
```

---

### Exercise 2: Letter / Optotype Discrimination

**Research basis:** Li et al. 2011, *Vision Research* — perceptual learning with flanked letter stimuli improved amblyopic eye acuity. Polat et al. 2004, *PNAS* — lateral masking paradigm.

Three paradigms selectable:

**Paradigm A — Flanked letter (lateral masking / crowding):**
```
Target: single Sloan letter, weak eye, at threshold size
Flankers: same letter × 2, placed at 1×, 2×, or 3× letter width either side
Strong eye: blank field at ICR luminance
Task: user types the target letter (keyboard)
Staircase: flanker spacing (2-down-1-up, 6 reversals)
Measures: crowding distance threshold
```

**Paradigm B — Contrast sensitivity sweep:**
```
Single letter, weak eye, decreasing Michelson contrast
Strong eye suppressed (ICR = 0.1 fixed)
Task: user types the letter
Staircase: Michelson contrast on log scale (3-down-1-up, targets 79.4%)
Measures: contrast threshold per spatial frequency
Letter size: fixed at 0.5° (fine detail training)
```

**Paradigm C — Vernier acuity:**
```
Two vertical line segments, weak eye
Top segment displaced left or right of bottom
Strong eye: blank at ICR luminance
Task: arrow keys (left / right)
Staircase: offset in pixels → mapped to arc-seconds (2-down-1-up)
Measures: Vernier threshold in arc-seconds
Clinical significance: Vernier acuity is degraded in amblyopia independent of grating acuity
```

```
Block: 60 trials per paradigm (~5 min)
Logged: threshold per paradigm, letter size, ICR
```

---

### Exercise 3: Binocular Rivalry Suppression Probe

**Research basis:** Baker, Meese & Hess 2008, *Vision Research* — probe detection through suppression directly measures suppression depth. Lunghi, Burr & Morrone 2011, *Current Biology* — monocular deprivation rapidly modulates suppression depth via homeostatic plasticity.

```
Strong eye: 90% contrast horizontal grating, continuous
Weak eye: vertical grating probe, 200ms, at random intervals (3–7s jitter)
Probe contrast varies via staircase

Task: press spacebar when probe is visible
  Hit: response within 500ms of probe onset
  Miss: no response within 500ms
  False alarm: response during no-probe interval (tracked, shown to user)

Staircase: 2-down-1-up on probe contrast
Block: 8-min run (~40 probe presentations)
Output: suppression depth threshold (probe contrast at 70.7% detection)

Also used as Assessment 4 when run in 5-min standalone mode
Logged to both session log and suppressionResults store
```

---

### Exercise 4: Dichoptic Global Motion Coherence

**Research basis:** Simmers et al. 2006, *IOVS* — amblyopic eyes show elevated motion coherence thresholds. Ho et al. 2005, *Vision Research* — motion processing deficit in amblyopia is independent of spatial resolution.

```
Random dot kinematogram:
  Coherent dots: move in signal direction, weak eye at full contrast
  Noise dots: random direction, both eyes at ICR-blended contrast
  Dot parameters:
    Radius: 2.5px
    Density: 3 dots/deg² (simulated via calibrated ppmm)
    Speed: 3°/s | 6°/s | 12°/s (selectable)
    Dot lifetime: 200ms (prevents position tracking)
    Field: circular aperture, 8° diameter

Coherence levels via staircase: 5%, 10%, 20%, 40%, 80%
Direction set: 8 directions (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°)
Response: arrow keys (4-direction simplified) or 1–8 number keys (8-direction)

Staircase: 3-down-1-up per speed condition (targets 79.4%)
Block: 80 trials (~6 min)
Logged: coherence threshold, speed condition, direction error pattern
```

---

### Exercise 5: Dichoptic Reading

**Research basis:** D.E.B.R.A. prototype (ScienceDirect, 2026) — participants read in anaglyph dichoptic presentation, confirming binocular integration of split text. CureSight RCT (*Ophthalmology*, 2022/2023) — red-blue anaglyph on desktop + eye tracker, 2.8 lines VA improvement at 16 weeks, noninferior to patching.

#### Mechanism

With red-cyan anaglyph glasses:
- Weak eye wears **red lens** → passes red, blocks cyan
- Strong eye wears **cyan lens** → passes cyan, blocks red
- Red text `#FF0000` → visible only to weak eye
- Cyan text `#00FFFF` → visible only to strong eye
- Black text `#000000` → both eyes (punctuation, spaces only)

Neither eye can read the full sentence alone. Brain forced to integrate both.

Eye assignment respects `weakEye` from profile. If weakEye = right, right lens = red.

#### ICR for reading

Strong eye text blended toward white background using `applyICR()`:
```typescript
// Weak eye: full red #FF0000 (ICR not applied)
// Strong eye: applyICR([0, 255, 255], icr) → lighter cyan
// At ICR 0.4: rgb(153, 255, 255)
// At ICR 0.2: rgb(204, 255, 255) — very faint, heavy reliance on weak eye
```

ICR range for reading: 0.2–1.0

#### Alternation modes

```
Word alternation (default):
  Odd-indexed words → weak eye color (red)
  Even-indexed words → strong eye color (ICR-blended cyan)
  "The quick brown fox jumped over the lazy dog"
   red  cyan   red  cyan   red    cyan  red  cyan  red

Line alternation:
  Odd lines → red, even lines → cyan
  Easier starting mode for new users

Phrase alternation (advanced):
  Natural phrase boundaries alternated
  Noun phrases, verb phrases split between eyes
  Hardest mode — maximum reliance on both eyes for semantic comprehension
```

#### Rendering

All text rendered on canvas via `renderDichopticText()` in canvasUtils.ts:
- Font: Georgia 20px (serif improves letter discrimination)
- Line height: 36px
- Max line width: 680px
- Manual word-by-word `fillText()` with `measureText()` for x-position
- Manual line wrapping (canvas has no CSS word-wrap)
- `renderDichopticText()` built and tested independently before DichopticReading.tsx

#### Pre-session calibration check

```
Screen shown before each session:
  Left half: single red word "RED" on white
  Right half: single cyan word "CYAN" on white
  Instruction: "With glasses on — can you see RED but not CYAN with your weak eye?"
  Two confirm buttons: [Yes, ready] [Something looks wrong → help]
  Help screen: diagram of glasses orientation, which lens goes on which eye
```

#### Session flow

```
Passage display:
  Full canvas, white background
  User reads at own pace
  "Next" button or spacebar advances page
  Reading speed inferred from time per page (words-per-minute estimate)

Post-passage comprehension:
  3 multiple-choice questions, 4 options each
  Stored in readingCorpus.ts alongside each passage

Corpus: 30 passages, 80–120 words each
  Flesch-Kincaid grade 6–8
  No color-related vocabulary
  No passages repeated within same 7-day window

Session: minimum 1 passage (~5–8 min), recommended 2–3

Logged:
  wpm (estimated)
  comprehension accuracy %
  alternation mode
  ICR
  passage ID
```

---

### Exercise 6: Fixation Stability Training

**Research basis:** Chung et al. 2006, *Vision Research* — eccentric fixation is a primary deficit in strabismic amblyopia. Gonzalez et al. 2012 — fixation training reduces eccentric fixation and improves VA.

**Enabled for:** strabismic and combined amblyopia only (set at onboarding).
**Shown as:** not applicable for anisometropic-only users.

```
Central fixation target: small cross (12px), weak eye
Surround ring: 80px radius circle outline, strong eye at ICR contrast
Distractors: small dots at 5–15° eccentricity, 200ms duration, random intervals

Task: hold fixation on central cross — passive, no response required
After each run: user rates fixation difficulty 1–5

Session: 4 × 30s runs, 10s rest between
Logged: difficulty rating, ICR, run duration
```

---

### ICR Cross-Session Adaptation

```typescript
// After each dichoptic exercise session:
// Staircase threshold ICR is compared to recent session history

// Improving: threshold ICR has increased over last 3 sessions
//   → bump currentICR up by 0.05 (stronger eye gets more contrast)
//   → signals brain better integrating both eyes at higher balance

// Stable: threshold flat across 3 sessions
//   → hold currentICR

// Regressing: threshold dropped
//   → hold ICR, show flag in progress dashboard
//   → suggest reducing session duration or checking for fatigue

// ICR displayed as "Balance level 1–10":
//   balanceLevel = Math.round(currentICR * 10)
//   "Balance level 3" = ICR 0.3

// ICRController.tsx:
//   Shows current balance level
//   Shows trend arrow (↑ improving / → stable / ↓ regressing)
//   Manual override: user can set ICR directly in advanced settings
```

---

## Phase 2: NOPT / VSS Module

### Module 1: Visual Noise Adaptation

**Research basis:** Montoya et al. 2023, *IOVS* (doi: 10.1167/iovs.64.15.23) — dynamic random visual noise adaptation caused total temporary disappearance of visual snow in 56% of 25 participants. Proposed mechanism: external noise and internal cortical noise average out neurologically, reducing net perceived noise.

```
Stimulus: full-field white noise
  Each pixel randomized per frame (Math.random() > 0.5 = white, else black)
  Rendered at 60fps via requestAnimationFrame
  Contrast slider: scales noise amplitude 0.3–1.0
  Canvas: fills full browser viewport

Adaptation durations (user selects before starting):
  5s / 15s / 45s / 135s
  Matches published protocol exactly

Post-adaptation measurement:
  Canvas transitions to solid mid-gray (#808080) immediately on timer end
  VAS slider: "Rate your current snow severity 0–10" (0 = none, 10 = severe)
  Timer counts up: user taps "Relief gone" when snow returns to baseline
  Both values stored: {post_severity, relief_duration_s}

Pre-session: user rates baseline snow severity 0–10 (stored as pre_severity)

Session cap: maximum 3 rounds per session
  3-minute mandatory rest between rounds (countdown shown)

Safety: if post_severity > pre_severity after round 1:
  Warning shown: "Your symptoms appear worse. End session?"
  [End session] [Continue anyway — I understand]

Logged: duration_s, post_severity, relief_duration_s, round_number
```

---

### Module 2: Saccadic Training

**Research basis:** Ciuffreda & Rutner 2025, *J. Clin. Med.* — saccadic training resets abnormally low saccadic suppression threshold underlying both palinopsia and VS intensity. ~90% success rate in clinical series. Solly et al. 2020, *Neurology*; 2021, *Sci. Rep.* — objective saccadic measurement as VS outcome measure.

Three sub-modes:

**Sub-mode A — Saccadic targeting:**
```
Two alternating fixation targets: black circles, 0.5° diameter
Eccentricity: 10° | 15° | 20° (user selects or adaptive)
Target appears → user fixates → spacebar → target jumps to other side
RT logged per trial; mean RT tracked

Adaptive: if mean RT < 250ms over 5 consecutive trials → increase eccentricity
Logged: RT per trial, eccentricity, mean RT
```

**Sub-mode B — Smooth pursuit:**
```
Single target traces sinusoidal horizontal path
Speed: 10°/s | 20°/s | 30°/s
Duration: 60 seconds per run
No response required
Post-run: user self-rates tracking smoothness 1–5
Logged: speed, self-rating
```

**Sub-mode C — Anti-saccade (advanced):**
```
Target flashes on one side
User must look to OPPOSITE side (tests inhibition of return)
Response window: 500ms
Error rate logged
Correct = saccade to opposite side within 500ms

Research basis: Foletta et al. 2021, Front. Neurol. —
  delayed inhibition of return documented in VSS
  directly targets this deficit

Logged: error rate, RT distribution
```

```
Session structure: 12–24 minutes selectable
Mirrors clinical protocol duration per Ciuffreda & Rutner 2025
```

---

### Module 3: Vergence + Accommodation Training

**Research basis:** Ciuffreda & Rutner 2025 — 60% of VSS patients show convergence insufficiency, accommodative insufficiency, or esophoria. Oculomotor remediation effective in ~90% of cases.

Three sub-modes:

**Sub-mode A — Convergence push-up:**
```
Two identical small circles shown side by side
User adjusts slider to move circles closer until fusion or break
Records break-point distance estimate (normalized 1–100 scale)
Staircase: if fusion held → increment difficulty
Tracks convergence range over sessions
```

**Sub-mode B — Accommodative rock:**
```
Text paragraph at simulated near (small font) and far (large font)
User alternates fixation, presses key when text is clear
Logs toggle RT — accommodation lag proxy
Duration: 3 minutes per run
```

**Sub-mode C — Binocular stability under noise:**
```
Central fixation cross on random-dot background
User holds fixation 30–60s
Background noise density gradually increases
Trains fixation stability under visual load
Directly targets VS cortical hyperexcitability context
```

---

### Module 4: Entoptic Desensitization

**Research basis:** Ciuffreda & Rutner 2025 Table 1 — 51% of VSS patients report enhanced entoptic phenomena. Goal is habituation via graded exposure.

Three sub-modes:

**Sub-mode A — Blue-field phosphene habituation:**
```
Display: uniform pale blue background (#AACFE4)
Note: NOT deep blue — avoids S-cone aggravation per Hepschke et al. 2021, Front. Neurol.
  (S-cone activation via blue-violet light aggravates VS symptoms)
User observes 2 minutes
Self-rates intrusiveness before and after (0–10)
Graded: start 30s, build to 3 min over sessions
```

**Sub-mode B — Floater desensitization:**
```
Clean white background
Translucent gray blob overlay (low contrast — not high contrast)
Moving external stimulus behind overlay diverts attention
Contrast of overlay: starts 30%, drops 5% per session if self-rating improves
Goal: reduce attentional salience of floaters
```

**Sub-mode C — Photopsia desensitization:**
```
Low-intensity white pulses (below photosensitivity threshold)
Duration: 10ms flash, 2000ms ISI
User rates intrusiveness each trial

LOCKED if photosensitive epilepsy confirmed at onboarding
Lock shown with explanation: "This exercise is not available due to your
photosensitivity profile. All other modules remain accessible."
```

---

### Module 5: Chromatic Simulator (informational only)

**Research basis:** Han et al. 2023, *Optom. Vis. Sci.* — orange-yellow and turquoise-blue filters reduce VS; blue-violet aggravates it. Hepschke et al. 2021 — S-cone activation via blue-violet is aggravating factor.

```
Canvas overlays CSS filter on a reference test pattern
Sliders: hue bias (0–360°), saturation (0–100%), opacity (10–60%)

Labeled spectral zones shown on hue slider:
  Blue-violet (240–280°): "May worsen symptoms"
  Orange-yellow (30–60°): "FL-41 range — may reduce symptoms"
  Turquoise-blue (170–200°): "May reduce symptoms"

Informational callouts:
  "Tint selection requires an optometrist with an Intuitive Colorimeter"
  "This tool is for education and exploration only"
  "No prescription or recommendation is generated here"

NOT_IMPLEMENTED note in code:
  // Intuitive Colorimeter precision tint matching — requires clinical hardware
  // FL-41 / BPI-Omega prescription — requires optometrist
```

---

## Progress Dashboard

```
Component: ProgressDashboard.tsx
All charts: canvas-rendered, no charting library

Panel 1 — Visual Acuity Trend (VAChart.tsx)
  Y-axis: logMAR, inverted (0.0 at top = better, 1.0 at bottom = worse)
  X-axis: date
  Two lines: weak eye (solid), strong eye (dashed, lighter)
  Clinical threshold lines:
    0.1 logMAR — "near normal"
    0.3 logMAR — "moderate amblyopia"
  Bracket annotation: "1 line = 0.1 logMAR"
  Milestone markers: vertical tick at sessions where threshold crossed
  Source: VAResult[]

Panel 2 — Contrast Sensitivity (CSFChart.tsx)
  Y-axis: AULCSF (higher = better)
  X-axis: date
  Two lines: weak eye, strong eye
  Shaded gap between lines = interocular difference
  Source: CSFResult[]

Panel 3 — Suppression Depth (SuppressionChart.tsx)
  Y-axis: probe contrast threshold % — inverted (lower = less suppression = better)
  X-axis: date
  Single line with shaded fill toward zero
  Label: "Lower = less suppression"
  Source: SuppressionResult[]

Panel 4 — Stereoacuity (StereoChart.tsx)
  Y-axis: log arc-seconds, inverted (lower = better)
  X-axis: date
  Clinical reference lines:
    800 arc-sec: gross stereopsis
    200 arc-sec: functional
    60 arc-sec: good
    40 arc-sec: normal
  Only shown if user has run StereoTest (requires anaglyph)
  Source: StereoResult[]

Panel 5 — Compliance heatmap (ComplianceHeatmap.tsx)
  GitHub contribution graph style
  52 columns (weeks) × 7 rows (days)
  Cell color: no session = var(--surface-1), 1–5 min = light, 5–15 min = mid, 15+ min = full
  Streak count shown above
  Source: Session[]
```

---

## Milestone System

```typescript
// milestones.ts
const MILESTONES = [
  {
    id: 'va_1line',
    metric: 'logMAR_improvement',
    threshold: 0.1,
    label: '1-line improvement',
    clinicalBasis: 'CureSight RCT 2022: ≥0.1 logMAR = measurable improvement'
  },
  {
    id: 'va_2line',
    metric: 'logMAR_improvement',
    threshold: 0.2,
    label: '2-line improvement',
    clinicalBasis: 'CureSight success criterion: ≥0.2 logMAR improvement'
  },
  {
    id: 'va_near_normal',
    metric: 'logMAR_absolute',
    threshold: 0.1,
    label: 'Near-normal acuity',
    clinicalBasis: 'Bynocs 2024: ≤0.1 logMAR amblyopic eye = treatment success'
  },
  {
    id: 'stereo_gross',
    metric: 'stereo_arcsec',
    threshold: 200,
    label: 'Gross stereopsis detected',
    clinicalBasis: 'Clinical threshold for measurable depth perception'
  },
  {
    id: 'stereo_functional',
    metric: 'stereo_arcsec',
    threshold: 60,
    label: 'Functional stereoacuity',
    clinicalBasis: 'Near-normal range boundary'
  },
  {
    id: 'suppression_halved',
    metric: 'suppression_pct_change',
    threshold: 50,
    label: 'Suppression halved',
    clinicalBasis: '50% reduction in suppression depth threshold'
  },
]

// Milestones shown as labeled vertical markers on chart lines
// Not badges or gamification — plain clinical annotations
// First time a milestone is crossed: brief inline notification
//   "1-line improvement reached — consistent with published treatment targets"
```

---

## App Navigation

```
Tab bar (bottom, mobile-first):
  [Train] [Assess] [Progress] [Guide] [Settings]

Train tab:
  Module selector: Dichoptic | NOPT
  Exercise list filtered by module
  Mode selector (anaglyph / side-by-side / screen-only) for dichoptic
  Settings panel (ICR / duration / speed / paradigm)
  Live exercise view with timer, pause, end

Assess tab:
  Four assessment cards: VA | CSF | Stereo | Suppression
  Each shows: last run date, last result, trend arrow
  Run button per assessment
  AssessmentRouter banners shown at top when overdue

Progress tab:
  ProgressDashboard with 5 panels
  Date range selector: 4 weeks | 3 months | All time

Guide tab:
  How dichoptic training works
  How NOPT exercises work
  Recommended protocol
  Exercise-by-exercise explanation with research citations
  Clinical disclaimer (persistent, not buried)

Settings tab:
  ProfileSettings (weak eye, diagnosis — editable)
  Calibration (re-run calibration wizard)
  Display mode default
  Assessment reminders on/off
  Export session data (JSON download)
  Reset all data
```

---

## Clinical Disclaimer

Shown persistently in Assessment tab footer and Guide tab header. Not dismissible.

```
"These exercises and measurements are based on published peer-reviewed research
in vision science and neuro-optometry (2020–2025). They are not a substitute for
clinical diagnosis or treatment by a licensed optometrist or ophthalmologist.

Screen-based measurements are validated for trend monitoring, not clinical diagnosis.
A clinician-measured baseline is recommended every 3–6 months.

Stop any exercise immediately if you experience: double vision, headache,
nausea, or worsening symptoms."
```

---

## Explicit Non-Implementations

Documented in code as comments at relevant component boundaries:

```typescript
// NOT_IMPLEMENTED: Intuitive Colorimeter precision tint matching
//   Requires clinical hardware (IC device, ~$15,000)
//   Reference: Rutner & Ciuffreda 2023, Vis. Dev. Rehab.

// NOT_IMPLEMENTED: FL-41 / BPI-Omega tint prescription
//   Requires optometrist assessment and fitting

// NOT_IMPLEMENTED: Prism diopter vergence measurement
//   Requires trial frame and prism bar — in-person clinical testing

// NOT_IMPLEMENTED: Saccadic velocity in deg/s
//   Requires calibrated infrared eye tracker

// NOT_IMPLEMENTED: Syntonic phototherapy
//   Requires clinical syntonizer device

// NOT_IMPLEMENTED: ETDRS at calibrated 3m/4m
//   Screen-based VA validated at 40cm (near chart protocol) only
//   3m+ requires room space and screen size outside home scope
```

---

## Research References

All exercises and assessments are grounded in the following:

**Dichoptic training:**
- Hess, Mansouri & Thompson 2010, *Current Biology* — ICR dichoptic grating training
- Vedamurthy et al. 2015, *eLife* — adult amblyopia dichoptic training
- Li et al. 2011, *Vision Research* — perceptual learning, flanked letters
- Polat et al. 2004, *PNAS* — lateral masking paradigm
- Baker, Meese & Hess 2008, *Vision Research* — suppression probe
- Lunghi, Burr & Morrone 2011, *Current Biology* — homeostatic plasticity, suppression
- Simmers et al. 2006, *IOVS* — motion coherence deficit in amblyopia
- Kramer et al. 2014, *Optom. Vis. Sci.* — dichoptic reading
- D.E.B.R.A. prototype 2026, *ScienceDirect* — dichoptic e-book reading
- CureSight RCT, *Ophthalmology* 2022/2023 — anaglyph home treatment RCT
- CureSight 1-year follow-up, *AJO* 2024 — sustained outcomes
- Bynocs 6-week study, *Children* 2024 — home-based dichoptic training outcomes
- Bynocs adult study 2025, *J. Cornea Ocular Surf.* — adult outcomes 24 months
- Chung et al. 2006, *Vision Research* — fixation stability in amblyopia

**VSS / NOPT:**
- Ciuffreda & Rutner 2025, *J. Clin. Med.* — six therapeutic approaches, August 2025
- Ciuffreda, Tannen et al. 2023, *Concussion* — neuro-optometric treatment advances
- Tannen, Brown et al. 2022, *Vis. Dev. Rehab.* — NORT retrospective analysis
- Tsang, Shidlofsky & Mora 2022, *Front. Neurol.* — NORT efficacy
- Montoya et al. 2023, *IOVS* — visual noise adaptation
- Han, Ciuffreda & Rutner 2023, *Optom. Vis. Sci.* — chromatic treatment
- Hepschke et al. 2021, *Front. Neurol.* — S-cone / blue-violet aggravation
- Solly et al. 2020, *Neurology*; 2021, *Sci. Rep.* — saccadic measures in VSS
- Foletta et al. 2021, *Front. Neurol.* — inhibition of return deficit in VSS
- Wong et al. 2024, *J. Neuro-Ophthalmol.* — mindfulness + fMRI connectivity

**Assessment validation:**
- Lesmes et al. 2010, *JOV* — qCSF Bayesian adaptive method
- Grieco-Calub et al. 2020, *Front. Med.* — gamified QUEST+ CSF for amblyopia home monitoring
- DigiVis validation, *Eye* 2021 — web-based VA, ICC 0.922 vs. gold standard
- COMPlog home VA, *Br. Irish Orthoptic J.* 2021 — no significant bias vs. in-clinic
