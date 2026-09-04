export type TrainingModule = 'dichoptic' | 'nopt';

export interface TrainingExerciseMeta {
  key: string;
  label: string;
  module: TrainingModule;
}

/** Single source of truth for exercise key/label, shared by App.tsx's routing
 * and anything (like TodayProgress) that needs to list exercises without
 * pulling in their components. */
export const TRAINING_EXERCISES: TrainingExerciseMeta[] = [
  { key: 'grating-fusion', label: 'Contrast-Defined Grating Fusion', module: 'dichoptic' },
  { key: 'letter-discrimination', label: 'Letter / Optotype Discrimination', module: 'dichoptic' },
  { key: 'rivalry-probe', label: 'Binocular Rivalry Suppression Probe', module: 'dichoptic' },
  { key: 'motion-coherence', label: 'Dichoptic Global Motion Coherence', module: 'dichoptic' },
  { key: 'dichoptic-reading', label: 'Dichoptic Reading', module: 'dichoptic' },
  { key: 'fixation-stability', label: 'Fixation Stability Training', module: 'dichoptic' },
  { key: 'noise-adaptation', label: 'Visual Noise Adaptation', module: 'nopt' },
  { key: 'saccadic-training', label: 'Saccadic Training', module: 'nopt' },
  { key: 'vergence-training', label: 'Vergence + Accommodation Training', module: 'nopt' },
  { key: 'entoptic-desensitization', label: 'Entoptic Desensitization', module: 'nopt' },
  { key: 'chromatic-simulator', label: 'Chromatic Simulator', module: 'nopt' },
];

export function labelForExercise(key: string): string {
  return TRAINING_EXERCISES.find((e) => e.key === key)?.label ?? key;
}
