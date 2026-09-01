import type { Module, DisplayMode } from './exercise';
import type { WeakEye } from './profile';

export interface Session {
  id: string;
  timestamp: string;
  module: Module;
  exercise: string;
  paradigm?: string;
  displayMode?: DisplayMode;
  weakEye: WeakEye;
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
