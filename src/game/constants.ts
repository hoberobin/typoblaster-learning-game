import type { GameSettings } from "./types";

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const PLAYER_X = GAME_WIDTH / 2;
export const PLAYER_Y = GAME_HEIGHT - 74;
export const FIRE_ORIGIN_Y = GAME_HEIGHT - 132;
export const DANGER_LINE_Y = GAME_HEIGHT - 58;

export const MAX_CREATURES = 4;
export const MAX_LETTER_BURSTS = 40;
export const MAX_PARTICLES = 180;
export const MAX_FLOATING_TEXTS = 30;

export const DEFAULT_SETTINGS: GameSettings = {
  reducedMotion: false,
  screenShake: true,
  soundEnabled: true,
  pace: "normal",
  gradeBand: "k2",
};

export const CREATURE_COLORS = ["#f0b429", "#ff8cab", "#8bd7ff", "#d6f26b", "#f7f2c5"];
