export type DisplayMode = 'anaglyph' | 'side_by_side' | 'screen_only';

export interface ExerciseSettings {
  displayMode: DisplayMode;
  icr: number;
  durationMinutes: number;
  speed: number;
}

export type Module = 'dichoptic' | 'nopt' | 'assessment';
