import { DANGER_LINE_Y, MAX_FLOATING_TEXTS, MAX_PARTICLES } from "./constants";
import { makeId, randomBetween } from "./random";
import type { Creature, GameState, Particle } from "./types";

export function activeCreature(state: GameState) {
  return state.creatures.find((creature) => creature.alive && creature.active);
}

export function currentRequiredLetter(creature: Creature) {
  return creature.word[creature.typedIndex] ?? "";
}

export function completeCreature(state: GameState, creature: Creature) {
  creature.alive = false;
  creature.active = false;
  state.wordsCompleted += 1;
  state.streak += 1;
  state.longestStreak = Math.max(state.longestStreak, state.streak);

  const points = 80 + creature.word.length * 20 + state.streak * 8 + creature.tier * 35;
  state.score += points;
  addBurst(state, creature.x, creature.y, creature.color);
  addFloatingText(state, `Snack! +${points}`, creature.x, creature.y - 38);
}

export function resolveBreaches(state: GameState, playDamage: () => void, playGameOver: () => void) {
  for (const creature of state.creatures) {
    if (!creature.alive || creature.breached) continue;
    if (creature.y + creature.radius < DANGER_LINE_Y) continue;

    creature.breached = true;
    creature.alive = false;
    creature.active = false;
    state.lives -= 1;
    state.streak = 0;
    state.lastDamageAt = state.elapsedSeconds;
    state.shakeTime = state.settings.reducedMotion ? 0 : 0.28;
    addFloatingText(state, "Next fly!", creature.x, DANGER_LINE_Y - 56, "danger");
    playDamage();

    if (state.lives <= 0) {
      state.status = "gameOver";
      state.lives = 0;
      playGameOver();
    }
  }
}

export function addCorrectBurst(state: GameState, letter: string, creature: Creature) {
  state.letterBursts.push({
    id: makeId("burst-letter"),
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
