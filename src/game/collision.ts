import { DANGER_LINE_Y, MAX_FLOATING_TEXTS, MAX_PARTICLES } from "./constants";
import { makeId, randomBetween } from "./random";
import type { Creature, GameState, Particle } from "./types";

export const PLAYER_MISSES_ALLOWED = 3;

export function activeCreature(state: GameState) {
  if (state.croakedPlayerIds.includes(state.currentPlayerId)) {
    const spectatorTarget = state.coopPlayers.find(
      (player) => !state.croakedPlayerIds.includes(player.id),
    );
    if (spectatorTarget) return activeCreatureForPlayer(state, spectatorTarget.id);
  }
  return activeCreatureForPlayer(state, state.currentPlayerId);
}

export function activeCreatureForPlayer(state: GameState, playerId: string) {
  if (state.croakedPlayerIds.includes(playerId)) return undefined;

  if (state.roundPhase === "boss") {
    const ownBoss = state.creatures.find(
      (creature) => creature.alive && creature.boss && creature.assignedPlayerId === playerId,
    );
    if (ownBoss) return ownBoss;

    return [...state.creatures]
      .filter(
        (creature) =>
          creature.alive && creature.boss && creature.assignedPlayerId !== playerId,
      )
      .sort((left, right) => right.y - left.y)[0];
  }

  const assigned = state.creatures.find(
    (creature) => creature.alive && creature.assignedPlayerId === playerId,
  );
  if (assigned) return assigned;

  return [...state.creatures]
    .filter(
      (creature) =>
        creature.alive &&
        creature.assignedPlayerId !== null &&
        creature.assignedPlayerId !== playerId &&
        creature.y + creature.radius >= DANGER_LINE_Y - creature.radius * 2,
    )
    .sort((left, right) => right.y - left.y)[0];
}

export function currentRequiredLetter(creature: Creature) {
  return creature.word[creature.typedIndex] ?? "";
}

export function completeCreature(state: GameState, creature: Creature, playerId = state.currentPlayerId) {
  creature.alive = false;
  creature.active = false;
  state.wordsCompleted += 1;
  state.teamFlyCount += 1;
  state.completedWords.push({
    word: creature.word,
    band: creature.band,
    tier: creature.tier,
  });
  state.streak += 1;
  state.longestStreak = Math.max(state.longestStreak, state.streak);

  const stolen =
    creature.assignedPlayerId !== null && creature.assignedPlayerId !== playerId;
  const bonusMultiplier = creature.bonus ? 2 : 1;
  const bossBonus = creature.boss ? 400 : 0;
  const stealBonus = stolen ? (creature.boss ? 120 : 45) : 0;
  const points =
    (80 + creature.word.length * 20 + state.streak * 8 + creature.tier * 35) * bonusMultiplier +
    stealBonus +
    bossBonus;
  state.score += points;
  addBurst(state, creature.x, creature.y, creature.color);
  addFloatingText(
    state,
    `${creature.boss ? "Boss!" : stolen ? "Steal!" : creature.bonus ? "Sparkle!" : "Snack!"} +${points}`,
    creature.x,
    creature.y - 38,
  );
}

export function resolveBreaches(state: GameState, playDamage: () => void, playGameOver: () => void) {
  for (const creature of state.creatures) {
    if (!creature.alive || creature.breached) continue;
    if (creature.y + creature.radius < DANGER_LINE_Y) continue;

    creature.breached = true;
    creature.alive = false;
    creature.active = false;
    state.streak = 0;
    state.lastDamageAt = state.elapsedSeconds;
    const playerCount = Math.max(1, state.coopPlayers.length);
    if (playerCount > 1) {
      const playerId = creature.assignedPlayerId ?? state.currentPlayerId;
      const nextMissCount = creature.boss
        ? PLAYER_MISSES_ALLOWED
        : (state.playerMissCounts[playerId] ?? 0) + 1;
      state.playerMissCounts[playerId] = nextMissCount;
      if (
        playerId &&
        nextMissCount >= PLAYER_MISSES_ALLOWED &&
        !state.croakedPlayerIds.includes(playerId)
      ) {
        state.croakedPlayerIds.push(playerId);
      }
      state.lives = Math.max(0, state.coopPlayers.length - state.croakedPlayerIds.length);
    } else {
      state.lives = creature.boss ? 0 : state.lives - 1;
    }
    if (state.elapsedSeconds - state.breachWindowStartedAt > 5) {
      state.breachWindowStartedAt = state.elapsedSeconds;
      state.breachCountInWindow = 0;
    }
    state.breachCountInWindow += 1;

    const spikeTooHard =
      !creature.boss &&
      playerCount <= 1 &&
      (state.breachCountInWindow >= 2 ||
        state.lives <= 1 ||
        state.creatures.length > playerCount * 3);
    if (spikeTooHard) {
      state.recoveryUntilSeconds = Math.max(state.recoveryUntilSeconds, state.elapsedSeconds + 12);
      state.recoveryWordsRemaining = Math.max(
        state.recoveryWordsRemaining,
        Math.min(12, 5 + playerCount),
      );
      addFloatingText(state, "Quick words incoming!", creature.x, DANGER_LINE_Y - 88, "danger");
    }

    state.shakeTime = state.settings.reducedMotion ? 0 : 0.28;
    addFloatingText(
      state,
      playerCount > 1 ? multiplayerBreachText(state, creature) : "Next fly!",
      creature.x,
      DANGER_LINE_Y - 56,
      "danger",
    );
    playDamage();

    if (state.lives <= 0 || allActivePlayersCroaked(state)) {
      state.status = "gameOver";
      state.lives = 0;
      playGameOver();
    }
  }
}

function allActivePlayersCroaked(state: GameState) {
  if (state.coopPlayers.length <= 1) return false;
  return state.coopPlayers.every((player) => state.croakedPlayerIds.includes(player.id));
}

function croakedPlayerName(state: GameState, creature: Creature) {
  const player = state.coopPlayers.find((entry) => entry.id === creature.assignedPlayerId);
  return player?.name || creature.assignedPlayerName || "A frog";
}

function multiplayerBreachText(state: GameState, creature: Creature) {
  const name = croakedPlayerName(state, creature);
  const playerId = creature.assignedPlayerId ?? state.currentPlayerId;
  const misses = state.playerMissCounts[playerId] ?? 0;
  if (misses >= PLAYER_MISSES_ALLOWED) return `${name} croaked!`;
  return `${name} slipped! ${PLAYER_MISSES_ALLOWED - misses} left`;
}

export function addCorrectBurst(
  state: GameState,
  letter: string,
  creature: Creature,
  playerId = state.currentPlayerId,
) {
  state.letterBursts.push({
    id: makeId("burst-letter"),
    playerId,
    letter,
    x: 480,
    y: 408,
    targetX: creature.x,
    targetY: creature.y - 42,
    progress: 0,
    life: 0.34,
    alive: true,
  });
}

export function addMistakeFeedback(state: GameState, creature: Creature | undefined) {
  if (state.mistakeFlashTime > 0) return;
  state.mistakeFlashTime = 0.28;
  state.shakeTime = state.settings.reducedMotion ? 0 : 0.1;
  addFloatingText(
    state,
    "Watch the yellow letter",
    creature?.x ?? 480,
    creature ? creature.y - 62 : 230,
    "danger",
  );
}

function addBurst(state: GameState, x: number, y: number, color: string) {
  for (let index = 0; index < 16; index += 1) {
    const particle: Particle = {
      id: makeId("particle"),
      x,
      y,
      vx: randomBetween(-135, 135),
      vy: randomBetween(-170, 90),
      life: 0.52,
      maxLife: 0.52,
      size: randomBetween(3, 7),
      color,
    };
    state.particles.push(particle);
  }

  if (state.particles.length > MAX_PARTICLES) {
    state.particles.splice(0, state.particles.length - MAX_PARTICLES);
  }
}

function addFloatingText(
  state: GameState,
  text: string,
  x: number,
  y: number,
  tone: "score" | "danger" = "score",
) {
  state.floatingTexts.push({
    id: makeId(`float-${tone}`),
    text,
    x,
    y,
    vy: tone === "danger" ? -14 : -34,
    life: tone === "danger" ? 0.85 : 0.72,
    maxLife: tone === "danger" ? 0.85 : 0.72,
  });

  if (state.floatingTexts.length > MAX_FLOATING_TEXTS) {
    state.floatingTexts.splice(0, state.floatingTexts.length - MAX_FLOATING_TEXTS);
  }
}
