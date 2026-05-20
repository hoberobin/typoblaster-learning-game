import { CREATURE_COLORS, DANGER_LINE_Y, GAME_WIDTH, MAX_CREATURES } from "./constants";
import { makeId, randomBetween, randomItem } from "./random";
import type { Creature, GameState, WordEntry, WordTier } from "./types";
import { getProgressiveWords, getRecoveryWords, getWordsForBand } from "./wordBank";

export function updateDifficulty(state: GameState) {
  const level = Math.max(1, state.roundNumber + Math.floor(state.elapsedSeconds / 32));
  state.level = level;
  const playerCount = Math.max(1, state.coopPlayers.length);
  const lpmPush = Math.min(2.8, Math.max(0, state.teamLettersPerMinute - 45) / 28);
  const pressureTarget = playerCount * 2.1 + level * 0.35 + lpmPush;
  const rawPressure = state.creatures.length - pressureTarget;
  state.adaptivePressure = state.adaptivePressure * 0.9 + rawPressure * 0.1;

  let interval: number;
  if (state.settings.pace === "progressive") {
    interval = Math.max(360, 2100 - level * 150);
  } else if (state.settings.pace === "relaxed") {
    interval = Math.max(2400, 4200 - level * 120);
  } else if (state.settings.pace === "challenge") {
    interval = Math.max(1100, 2600 - level * 170);
  } else {
    interval = Math.max(1500, 3300 - level * 140);
  }

  if (isRecoveryActive(state)) interval *= 1.45;
  else if (state.adaptivePressure < -1.6) interval *= 0.72;
  else if (state.adaptivePressure > 2.2) interval *= 1.22;
  interval *= Math.max(0.62, 1 - lpmPush * 0.08);

  state.spawnIntervalMs = Math.max(320, Math.round(interval));
}

export function creatureSpeedFor(state: GameState, tier: WordTier) {
  const tierBoost = tier * 4;
  const recoveryDrag = isRecoveryActive(state) ? -4 : 0;
  const pressureLift = Math.max(-2, Math.min(4, -state.adaptivePressure * 0.45));
  const lpmLift = Math.min(5, Math.max(0, state.teamLettersPerMinute - 55) / 18);
  if (state.settings.pace === "progressive") {
    return 18 + state.level * 3.8 + tierBoost + recoveryDrag + pressureLift + lpmLift;
  }
  if (state.settings.pace === "relaxed") return 15 + state.level * 2.2 + tierBoost + recoveryDrag + pressureLift + lpmLift;
  if (state.settings.pace === "challenge") return 28 + state.level * 4.6 + tierBoost + recoveryDrag + pressureLift + lpmLift;
  return 21 + state.level * 3.3 + tierBoost + recoveryDrag + pressureLift + lpmLift;
}

export function ensureActiveCreature(state: GameState, timestamp: number) {
  if (state.roundPhase !== "swarm") return;
  if (state.creatures.length >= Math.max(4, state.coopPlayers.length)) return;
  if (state.creatures.length >= MAX_CREATURES) return;

  state.lastSpawnAt = timestamp;
  state.creatures.push(createCreature(state, timestamp));
}

export function spawnPreviewCreatures(state: GameState, timestamp: number) {
  if (state.roundPhase !== "swarm") return;
  if (state.creatures.length >= MAX_CREATURES) return;
  if (timestamp - state.lastSpawnAt < state.spawnIntervalMs) return;

  state.lastSpawnAt = timestamp;
  const pressureLimited = state.adaptivePressure > 2.2;
  const lpmSwarm = state.teamLettersPerMinute >= 80 ? 1 : 0;
  const baseSwarm = 1 + Math.floor(state.level / 2) + Math.floor(state.coopPlayers.length / 2) + lpmSwarm;
  const adaptiveBonus = state.adaptivePressure < -1.6 ? 1 : 0;
  const recoveryCap = isRecoveryActive(state) ? 2 : Number.POSITIVE_INFINITY;
  const swarmCount = Math.min(
    MAX_CREATURES - state.creatures.length,
    recoveryCap,
    pressureLimited ? Math.max(1, Math.floor(baseSwarm / 2)) : baseSwarm + adaptiveBonus,
  );
  for (let index = 0; index < swarmCount; index += 1) {
    state.creatures.push(createCreature(state, timestamp + index * 13));
  }
}

export function promoteNextCreature(state: GameState) {
  const currentPlayerId = state.currentPlayerId;
  state.creatures.forEach((creature) => {
    const stealable =
      creature.assignedPlayerId !== null &&
      creature.assignedPlayerId !== currentPlayerId &&
      creature.y + creature.radius >= DANGER_LINE_Y - creature.radius * 2;
    creature.active = creature.assignedPlayerId === currentPlayerId || stealable;
  });
}

function createCreature(state: GameState, timestamp: number): Creature {
  const recovery = shouldSpawnRecoveryWord(state);
  const wordEntry = recovery ? randomItem(getRecoveryWords()) : nextWord(state);
  const lane = randomBetween(80, GAME_WIDTH - 80);
  const bonus = !recovery && (wordEntry.tier === 3 || /[jqxzvy]/.test(wordEntry.word));
  if (recovery) state.recoveryWordsRemaining = Math.max(0, state.recoveryWordsRemaining - 1);
  return {
    id: makeId("creature"),
    word: wordEntry.word,
    displayText: wordEntry.word,
    band: wordEntry.band,
    assignedPlayerId: null,
    assignedPlayerName: "",
    assignedPlayerEmoji: "",
    bonus,
    recovery,
    boss: false,
    typedIndex: 0,
    tier: wordEntry.tier,
    x: lane,
    y: randomBetween(-92, -18),
    radius: bonus ? 39 : recovery ? 30 : 34,
    speed: Math.max(12, creatureSpeedFor(state, wordEntry.tier)) * randomBetween(0.86, 1.16),
    alive: true,
    active: false,
    breached: false,
    createdAt: timestamp,
    wobbleSeed: randomBetween(0, Math.PI * 2),
    color: randomItem(CREATURE_COLORS),
  };
}

function shouldSpawnRecoveryWord(state: GameState) {
  if (!isRecoveryActive(state) || state.recoveryWordsRemaining <= 0) return false;
  return Math.random() < 0.82;
}

function nextWord(state: GameState): WordEntry {
  if (state.wordQueue.length === 0) {
    state.wordQueue = shuffledWords(state);
  }

  return state.wordQueue.shift() ?? randomItem(wordsForState(state));
}

export function shuffledWords(state: GameState) {
  const words = [...wordsForState(state)];
  for (let index = words.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [words[index], words[swapIndex]] = [words[swapIndex], words[index]];
  }
  return words;
}

function wordsForState(state: GameState) {
  if (state.settings.pace === "progressive") {
    return getProgressiveWords(state.settings.gradeBand, state.level);
  }

  return getWordsForBand(state.settings.gradeBand, tierForLevel(state.level));
}

function isRecoveryActive(state: GameState) {
  return state.elapsedSeconds < state.recoveryUntilSeconds && state.recoveryWordsRemaining > 0;
}

function tierForLevel(level: number): WordTier {
  if (level >= 4) return 3;
  if (level >= 2) return 2;
  return 1;
}
