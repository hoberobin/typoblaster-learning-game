import { DANGER_LINE_Y, GAME_HEIGHT, GAME_WIDTH, PLAYER_X, PLAYER_Y } from "./constants";
import { currentRequiredLetter } from "./collision";
import type { Creature, GameState } from "./types";

export function resizeCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = GAME_WIDTH * dpr;
  canvas.height = GAME_HEIGHT * dpr;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function render(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.save();
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  if (state.settings.screenShake && state.shakeTime > 0 && !state.settings.reducedMotion) {
    const shake = state.shakeTime * 10;
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  drawBackground(ctx, state);
  drawLearningHeader(ctx, state);
  drawDangerLine(ctx, state);
  state.creatures.forEach((creature) => drawCreature(ctx, creature, state.elapsedSeconds));
  drawLetterBursts(ctx, state);
  drawPlayerCreature(ctx, state);
  drawParticles(ctx, state);
  drawFloatingText(ctx, state);
  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, state: GameState) {
  const drift = state.settings.reducedMotion ? 0 : (state.elapsedSeconds * 10) % 96;
  const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  gradient.addColorStop(0, "#b9f3ff");
  gradient.addColorStop(0.42, "#6fd1d5");
  gradient.addColorStop(0.43, "#24856f");
  gradient.addColorStop(1, "#0d5147");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.beginPath();
  ctx.arc(92, 72, 38, 0, Math.PI * 2);
  ctx.arc(130, 68, 48, 0, Math.PI * 2);
  ctx.arc(178, 76, 34, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.beginPath();
  ctx.arc(724, 92, 26, 0, Math.PI * 2);
  ctx.arc(754, 86, 38, 0, Math.PI * 2);
  ctx.arc(794, 96, 27, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(232,255,231,0.18)";
  ctx.lineWidth = 2;
  for (let y = 250 + drift; y < GAME_HEIGHT + 96; y += 96) {
    ctx.beginPath();
    ctx.moveTo(-40, y);
    ctx.bezierCurveTo(180, y - 24, 320, y + 28, 520, y);
    ctx.bezierCurveTo(700, y - 22, 820, y + 18, GAME_WIDTH + 40, y - 8);
    ctx.stroke();
  }

  drawLilyPad(ctx, 94, 420, 74, -0.25);
  drawLilyPad(ctx, 825, 384, 58, 0.35);
  drawLilyPad(ctx, 714, 494, 70, -0.6);
  drawReeds(ctx, 30, 344, 1);
  drawReeds(ctx, 885, 332, -1);

  ctx.fillStyle = "rgba(247,255,201,0.34)";
  ctx.fillRect(0, 0, GAME_WIDTH, 92);
}

function drawLearningHeader(ctx: CanvasRenderingContext2D, state: GameState) {
  const active = state.creatures.find((creature) => creature.active && creature.alive);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#173d34";
  ctx.font = "700 18px 'Courier New', monospace";
  ctx.fillText("Type the fly word from left to right", GAME_WIDTH / 2, 28);

  if (active) {
    drawWordProgress(ctx, active, GAME_WIDTH / 2, 66, 34);
  }

  if (state.mistakeFlashTime > 0) {
    ctx.fillStyle = "rgba(255,94,120,0.18)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
  ctx.restore();
}

function drawDangerLine(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.save();
  ctx.strokeStyle = state.lives <= 1 ? "#e03e52" : "rgba(21,82,62,0.5)";
  ctx.setLineDash([18, 12]);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, DANGER_LINE_Y);
  ctx.lineTo(GAME_WIDTH, DANGER_LINE_Y);
  ctx.stroke();
  ctx.fillStyle = state.lives <= 1 ? "#e03e52" : "#17493c";
  ctx.font = "700 15px 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.fillText("catch flies before they cross the lily pad line", 24, DANGER_LINE_Y - 12);
  ctx.restore();
}

function drawCreature(ctx: CanvasRenderingContext2D, creature: Creature, elapsedSeconds: number) {
  const wobble = Math.sin(elapsedSeconds * 2.5 + creature.wobbleSeed) * (creature.active ? 5 : 3);
  const x = creature.x + wobble;
  const y = creature.y;

  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = creature.active ? 1 : 0.55;

  const wingFlap = Math.sin(elapsedSeconds * 18 + creature.wobbleSeed) * 0.18;

  ctx.fillStyle = "rgba(221,250,255,0.72)";
  ctx.strokeStyle = "rgba(32,95,87,0.62)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-24, -8, 22, 13, -0.65 + wingFlap, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(24, -8, 22, 13, 0.65 - wingFlap, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = creature.active ? "#1f2824" : "#39463e";
  ctx.strokeStyle = creature.active ? "#fff7bd" : "rgba(255,247,189,0.65)";
  ctx.lineWidth = creature.active ? 4 : 3;

  ctx.beginPath();
  ctx.ellipse(0, 0, creature.radius * 0.72, creature.radius * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = creature.color;
  ctx.beginPath();
  ctx.ellipse(0, 6, creature.radius * 0.44, creature.radius * 0.54, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f7fbff";
  ctx.beginPath();
  ctx.arc(-11, -12, 9, 0, Math.PI * 2);
  ctx.arc(11, -12, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1f2824";
  ctx.beginPath();
  ctx.arc(-9, -11, 4, 0, Math.PI * 2);
  ctx.arc(9, -11, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(31,40,36,0.75)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-14, 26);
  ctx.lineTo(-31, 38);
  ctx.moveTo(14, 26);
  ctx.lineTo(31, 38);
  ctx.stroke();
  ctx.restore();

  drawCreatureWord(ctx, creature, x, y);
}

function drawCreatureWord(ctx: CanvasRenderingContext2D, creature: Creature, x: number, y: number) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,252,218,0.94)";
  roundRect(ctx, x - wordWidth(creature.word) / 2 - 18, y - creature.radius - 68, wordWidth(creature.word) + 36, 48, 12);
  ctx.fill();
  ctx.strokeStyle = creature.active ? "#f4c542" : "rgba(31,91,77,0.48)";
  ctx.lineWidth = 3;
  ctx.stroke();
  drawWordProgress(ctx, creature, x, y - creature.radius - 44, creature.active ? 30 : 24);
  ctx.restore();
}

function drawWordProgress(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  centerX: number,
  centerY: number,
  fontSize: number,
) {
  const letters = creature.word.toUpperCase().split("");
  const spacing = Math.min(38, Math.max(25, 360 / Math.max(letters.length, 1)));
  const startX = centerX - ((letters.length - 1) * spacing) / 2;

  ctx.save();
  ctx.font = `800 ${fontSize}px 'Courier New', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  letters.forEach((letter, index) => {
    const x = startX + index * spacing;
    if (index < creature.typedIndex) {
      ctx.fillStyle = "#238869";
    } else if (index === creature.typedIndex) {
      ctx.fillStyle = "#cf7f14";
      ctx.strokeStyle = "rgba(255,215,90,0.62)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(x, centerY, fontSize * 0.68, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(26,58,49,0.72)";
    }
    ctx.strokeStyle = "rgba(255,252,218,0.84)";
    ctx.lineWidth = 5;
    ctx.strokeText(letter, x, centerY);
    ctx.fillText(letter, x, centerY);
  });
  ctx.restore();
}

function drawPlayerCreature(ctx: CanvasRenderingContext2D, state: GameState) {
  const bob = state.settings.reducedMotion ? 0 : Math.sin(state.elapsedSeconds * 4) * 3;
  ctx.save();
  ctx.translate(PLAYER_X, PLAYER_Y + bob);

  drawLilyPad(ctx, 0, 28, 88, 0.1);

  ctx.fillStyle = "#55c75c";
  ctx.strokeStyle = "#173d34";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 62, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#79d96f";
  ctx.beginPath();
  ctx.arc(-32, -18, 18, 0, Math.PI * 2);
  ctx.arc(32, -18, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#173d34";
  ctx.beginPath();
  ctx.arc(-25, -18, 6, 0, Math.PI * 2);
  ctx.arc(25, -18, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffdf6b";
  ctx.beginPath();
  ctx.arc(-6, 7, 4, 0, Math.PI * 2);
  ctx.arc(15, 13, 3, 0, Math.PI * 2);
  ctx.arc(-24, 6, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#173d34";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 5, 22, 0.08, Math.PI - 0.08);
  ctx.stroke();
  ctx.restore();
}

function drawLetterBursts(ctx: CanvasRenderingContext2D, state: GameState) {
  state.letterBursts.forEach((burst) => {
    const ease = 1 - Math.pow(1 - burst.progress, 3);
    const x = burst.x + (burst.targetX - burst.x) * ease;
    const y = burst.y + (burst.targetY - burst.y) * ease;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - burst.progress * 0.35);
    ctx.strokeStyle = "#ff8cab";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(PLAYER_X, PLAYER_Y - 18);
    ctx.quadraticCurveTo((PLAYER_X + x) / 2, y + 54, x, y);
    ctx.stroke();

    ctx.fillStyle = "#ffef7b";
    ctx.strokeStyle = "#173d34";
    ctx.lineWidth = 4;
    ctx.font = "800 28px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(burst.letter.toUpperCase(), x, y);
    ctx.fillText(burst.letter.toUpperCase(), x, y);
    ctx.restore();
  });
}

function drawParticles(ctx: CanvasRenderingContext2D, state: GameState) {
  state.particles.forEach((particle) => {
    const alpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = hexToRgba(particle.color, alpha);
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  });
}

function drawFloatingText(ctx: CanvasRenderingContext2D, state: GameState) {
  state.floatingTexts.forEach((text) => {
    const alpha = Math.max(0, text.life / text.maxLife);
    const isDanger =
      text.text.toLowerCase().includes("watch") || text.text.toLowerCase().includes("next");
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = isDanger ? "#e03e52" : "#ffef7b";
    ctx.strokeStyle = "#173d34";
    ctx.lineWidth = 5;
    ctx.font = `800 ${isDanger ? 22 : 28}px 'Courier New', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(text.text, text.x, text.y);
    ctx.fillText(text.text, text.x, text.y);
    ctx.restore();
  });
}

function drawLilyPad(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, rotation: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = "#4faf59";
  ctx.strokeStyle = "#1d6a4e";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0.24, Math.PI * 1.86);
  ctx.lineTo(8, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(232,255,206,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(radius * 0.62, -radius * 0.16);
  ctx.moveTo(0, 0);
  ctx.lineTo(-radius * 0.36, -radius * 0.44);
  ctx.moveTo(0, 0);
  ctx.lineTo(-radius * 0.46, radius * 0.34);
  ctx.stroke();
  ctx.restore();
}

function drawReeds(ctx: CanvasRenderingContext2D, x: number, y: number, direction: 1 | -1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#23684b";
  ctx.fillStyle = "#8c5b2f";
  ctx.lineWidth = 5;
  for (let index = 0; index < 6; index += 1) {
    const offset = index * 14 * direction;
    const height = 82 + index * 9;
    ctx.beginPath();
    ctx.moveTo(offset, 148);
    ctx.quadraticCurveTo(offset + 10 * direction, 76, offset + 2 * direction, 148 - height);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(offset + 2 * direction, 140 - height, 7, 20, 0.08 * direction, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function wordWidth(word: string) {
  return Math.min(520, Math.max(120, word.length * 32));
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
