import { DEFAULT_SETTINGS } from "./constants";
import type { GameSettings } from "./types";

const HIGH_SCORE_KEY = "typoblaster.highScore";
const SETTINGS_KEY = "typoblaster.settings";

export function loadHighScore() {
  try {
    return Number(window.localStorage.getItem(HIGH_SCORE_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number) {
  try {
    window.localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    // localStorage can be unavailable in private or embedded contexts.
  }
}

export function loadSettings(): GameSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      pace:
        parsed.pace === "relaxed" ||
        parsed.pace === "normal" ||
        parsed.pace === "challenge" ||
        parsed.pace === "progressive"
          ? parsed.pace
          : DEFAULT_SETTINGS.pace,
      gradeBand:
        parsed.gradeBand === "g35" || parsed.gradeBand === "g68"
          ? parsed.gradeBand
          : DEFAULT_SETTINGS.gradeBand,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: GameSettings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage can be unavailable in private or embedded contexts.
  }
}
