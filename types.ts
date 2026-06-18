/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameState = 'menu' | 'tutorial' | 'playing' | 'gameover' | 'paused';

export type GameDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export type GameMode = 'instant' | 'timed_60' | 'survival';

export interface ScoreRecord {
  id: string;
  playerName: string;
  score: number;
  accuracy: number;
  difficulty: GameDifficulty;
  mode?: GameMode;
  date: string;
  shotsFired: number;
  targetsHit: number;
  maxCombo: number;
}

export interface Target {
  id: string;
  x: number; // Percentage on canvas (0 to 1) or coordinate
  y: number; // Percentage on canvas (0 to 1) or coordinate
  radius: number;
  type: 'regular' | 'speedy' | 'bomb' | 'shield' | 'boss';
  vx: number; // Velocity x
  vy: number; // Velocity y
  points: number;
  color: string;
  health: number; // For tanky targets or boss targets
  maxHealth: number;
  createdAt: number;
  pulseSpeed: number;
  pulsePhase: number;
  shrinkRate: number; // If medium/hard targets shrink
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
  growth: number;
}

export interface GestureCalibration {
  pinchThreshold: number;
  aimSmoothing: number; // 0.1 to 1.0 (lower is smoother, higher is faster)
  mirrorCamera: boolean;
  gestureChoice: 'pinch' | 'finger-gun' | 'all';
  aimSensitivity?: number;
}
