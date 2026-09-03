export interface ExerciseInfo {
  title: string;
  summary: string;
  steps: string[];
  duration?: string;
}

/**
 * Plain-language "what is this / how do I use it" content shown once before
 * a user enters an exercise or assessment for the first time in a session.
 * Keyed to match the exercise `key`s in App.tsx's registries, plus the
 * assessment keys ('va' | 'csf' | 'stereo' | 'suppression').
 */
export const EXERCISE_INFO: Record<string, ExerciseInfo> = {
  'grating-fusion': {
    title: 'Contrast-Defined Grating Fusion',
    summary:
      "The core dichoptic exercise. Your weak eye sees a full-strength pattern, your strong eye sees a fainter one at the same time — over sessions the app narrows that gap, pushing your visual system to combine both eyes instead of tuning one out.",
    steps: [
      'Put on your red/cyan glasses.',
      'Pick a spatial frequency and (optionally) a flicker rate, then Start.',
      'After each ~2-second pattern, press F if it looked like one combined (fused) pattern, or R if it looked like it was flickering or alternating (rivalry).',
      "You'll have about half a second to respond after each one — don't overthink it, go with your first impression.",
    ],
    duration: '~3 minutes, 40 trials',
  },
  'letter-discrimination': {
    title: 'Letter / Optotype Discrimination',
    summary:
      'Three perceptual-learning drills for your weak eye — crowding (reading a letter surrounded by clutter), fading contrast, and fine position (Vernier) sensitivity.',
    steps: [
      'Put on your glasses.',
      'Pick a paradigm: Flanked letter, Contrast sweep, or Vernier acuity.',
      'For Flanked/Contrast: type the single letter you see. For Vernier: click Left or Right for which way the top line segment is offset.',
      'Each paradigm runs 60 trials (~5 minutes) and gets harder as you succeed.',
    ],
  },
  'rivalry-probe': {
    title: 'Binocular Rivalry Suppression Probe',
    summary:
      'Measures and trains suppression — how much your brain is tuning out the weak eye. A steady pattern stays visible to your strong eye while a faint probe briefly flashes to your weak eye at random moments.',
    steps: [
      'Put on your glasses and keep your eyes on the display.',
      'Press spacebar the instant you notice the faint vertical probe.',
      "Pressing when there's no probe counts as a false alarm — it won't stop the session, just try to stay accurate.",
      'Runs continuously for several minutes; the probe gets fainter as you keep catching it.',
    ],
  },
  'motion-coherence': {
    title: 'Dichoptic Global Motion Coherence',
    summary:
      'Trains picking out an overall direction hidden in a field of moving dots — a skill often weaker in the amblyopic eye. Your weak eye sees the "real" signal; both eyes see shared background noise.',
    steps: [
      'Put on your glasses and pick a dot speed.',
      'Watch the moving dots for about 1.5 seconds.',
      'Press the number key (1-8) matching the direction most dots moved — use the on-screen legend as a guide.',
      '80 trials, ~6 minutes.',
    ],
  },
  'dichoptic-reading': {
    title: 'Dichoptic Reading',
    summary:
      'Trains binocular integration through reading: words alternate between your weak eye (red) and strong eye (cyan), so neither eye alone can read the full sentence — your brain has to combine them.',
    steps: [
      'Put on your glasses.',
      'On the check screen, confirm you can see RED but not CYAN with your weak eye (use the help screen if the colors seem swapped).',
      'Pick an alternation mode — start with Line if this is new to you.',
      'Read at your own pace, press Next when done, then answer 3 quick comprehension questions.',
      'Aim for 1-3 passages per session.',
    ],
  },
  'fixation-stability': {
    title: 'Fixation Stability Training',
    summary:
      'For strabismic or combined-mechanism amblyopia — trains holding steady central fixation despite distractions, which helps correct off-center (eccentric) fixation.',
    steps: [
      'Put on your glasses.',
      'Keep your gaze on the small central cross the whole time — no response needed, even if you notice flashes near the edges.',
      "That's the point: those are distractors testing whether you stay fixated.",
      'Four 30-second runs with a 10-second rest between each; rate the difficulty after each run.',
    ],
  },
  'noise-adaptation': {
    title: 'Visual Noise Adaptation',
    summary:
      "Based on research showing that watching dynamic visual \"static\" can temporarily quiet visual snow — external noise appears to average out with your brain's own internal noise.",
    steps: [
      'Rate your current snow severity (0-10) before starting.',
      'Pick a duration and noise strength, then watch the full-screen static.',
      'Right after, rate your severity again.',
      "Tap \"Relief gone\" once your snow returns to its usual level — that's timed and logged.",
      'Up to 3 rounds per session, with a mandatory 3-minute rest between rounds.',
    ],
  },
  'saccadic-training': {
    title: 'Saccadic Training',
    summary:
      'Targets the slow or inaccurate eye movements common in visual snow syndrome, through three separate drills.',
    steps: [
      'Pick a sub-mode: Targeting (jump your gaze between two points, spacebar the instant you land on the new one), Smooth pursuit (just track a slowly moving target with your eyes — no keys needed), or Anti-saccade (look away from a flashed target, advanced).',
      'Pick a session length (12 or 24 minutes).',
      'Follow the on-screen prompts for whichever sub-mode you picked.',
    ],
  },
  'vergence-training': {
    title: 'Vergence + Accommodation Training',
    summary:
      'Targets convergence and focusing problems, found in roughly 60% of visual snow patients, through three drills.',
    steps: [
      'Pick a sub-mode: Convergence push-up (tap Held or Broke as two circles are brought closer together, testing how long you can keep them fused), Accommodative rock (press spacebar the moment alternating near/far text looks sharp), or Binocular stability (just hold fixation as background noise gradually increases).',
      'Follow the on-screen prompts for whichever sub-mode you picked.',
    ],
  },
  'entoptic-desensitization': {
    title: 'Entoptic Desensitization',
    summary:
      'Uses graded exposure to make floaters, phosphenes, and light flashes feel less intrusive over time — this is habituation, not removal.',
    steps: [
      'Pick a sub-mode: Blue-field (watch a plain pale-blue screen), Floater (watch a moving shape behind a translucent overlay), or Photopsia (rate brief light pulses — locked if you flagged photosensitive epilepsy at onboarding).',
      "Rate how intrusive things feel before and after.",
      'Sessions gradually get longer or harder as you tolerate them better, based on your ratings.',
    ],
  },
  'chromatic-simulator': {
    title: 'Chromatic Simulator',
    summary:
      'An educational tool for exploring how different color tints might affect visual snow symptoms. It does not generate a prescription.',
    steps: [
      'Drag the hue, saturation, and opacity sliders to try different tints over the test pattern.',
      'Note the labeled zones on the hue slider: blue-violet may worsen symptoms; orange-yellow and turquoise-blue ranges are reported to help some people.',
      'This is exploratory only — an actual tint prescription requires an optometrist with specialized equipment.',
    ],
  },
  va: {
    title: 'Visual Acuity Test',
    summary:
      'Measures how sharp your vision is in your weak eye only, using standard eye-chart-style letters — similar to an in-clinic exam.',
    steps: [
      'Cover your strong eye completely before starting.',
      'Type the 5 letters you see per row on your keyboard.',
      'Rows get smaller (harder) the more you get right, bigger (easier) if you struggle.',
      'The test ends automatically after two rows in a row where you get 2 or fewer correct.',
    ],
    duration: '~2-3 minutes',
  },
  csf: {
    title: 'Contrast Sensitivity Test',
    summary:
      'Measures the faintest pattern you can still detect at several pattern sizes — a more complete picture than acuity alone. Run separately for each eye.',
    steps: [
      'Cover the eye that is not being tested.',
      'A brief tilted pattern flashes for just 200ms.',
      'Press the arrow key matching the tilt direction as soon as you see it — you can respond during the flash or right after.',
      'Some flashes are deliberately very faint, close to the edge of what you can see — that\'s how the test finds your threshold, not a sign anything is wrong.',
    ],
    duration: '~4 minutes per eye, 25 trials each',
  },
  stereo: {
    title: 'Stereoacuity Test',
    summary:
      'Measures your depth perception from combining both eyes, using a hidden-circle 3D illusion. Requires red/cyan glasses.',
    steps: [
      'Put on your glasses.',
      'A circle is hidden somewhere in the dot pattern — only visible once your eyes fuse the image in 3D.',
      'Tap which quadrant it appears in (top-left, top-right, bottom-left, bottom-right).',
      '20 trials; the disparity shrinks as you keep finding it correctly.',
    ],
    duration: '~2-3 minutes',
  },
  suppression: {
    title: 'Suppression Assessment',
    summary:
      'The standalone 5-minute version of the Rivalry Probe exercise, used as a weekly measurement of how much your brain is suppressing the weak eye.',
    steps: [
      'Put on your glasses and keep your eyes on the display.',
      'Press spacebar the instant you notice the faint probe.',
      "Pressing when there's no probe counts as a false alarm — don't worry, just try to stay accurate.",
    ],
    duration: '~5 minutes',
  },
};
