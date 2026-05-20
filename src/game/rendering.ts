import { DANGER_LINE_Y, GAME_HEIGHT, GAME_WIDTH, PLAYER_X, PLAYER_Y } from "./constants";
import { activeCreature, currentRequiredLetter } from "./collision";
import type { CoopPlayer, Creature, GameState } from "./types";

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
  const target = activeCreature(state);
  state.creatures
    .filter((creature) => creature.id !== target?.id)
    .forEach((creature) => drawCreature(ctx, creature, state, false));
  if (target) drawCreature(ctx, target, state, true);
  drawLetterBursts(ctx, state);
  drawPlayerCreatures(ctx, state);
  drawParticles(ctx, state);
  drawFloatingText(ctx, state);
  drawRoundPhaseOverlay(ctx, state);
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
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#173d34";
  ctx.font = "800 16px 'Courier New', monospace";
  ctx.fillText(`ROUND ${state.roundNumber} · TEAM ${state.teamLettersPerMinute} LPM`, GAME_WIDTH / 2, 28);

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

function drawCreature(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  state: GameState,
  isTarget: boolean,
) {
  const elapsedSeconds = state.elapsedSeconds;
  const stealable =
    creature.assignedPlayerId !== null &&
    creature.assignedPlayerId !== state.currentPlayerId &&
    creature.y + creature.radius >= DANGER_LINE_Y - creature.radius * 2;
  const wobble = Math.sin(elapsedSeconds * 2.5 + creature.wobbleSeed) * (creature.active ? 5 : 3);
  const x = creature.x + wobble;
  const y = creature.y;

  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = isTarget ? 1 : stealable ? 0.68 : 0.48;

  if (creature.bonus) {
    drawSparkles(ctx, elapsedSeconds + creature.wobbleSeed, creature.radius + 12);
  }

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

  ctx.fillStyle = isTarget ? "#171f1c" : stealable ? "#2a242e" : "#39463e";
  ctx.strokeStyle = isTarget
    ? "#fff27a"
    : stealable
      ? "#ff8cab"
      : creature.bonus
        ? "rgba(255,242,122,0.78)"
        : "rgba(255,247,189,0.65)";
  ctx.lineWidth = isTarget ? 5 : 3;

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
  const glare = Math.min(7, state.level);
  ctx.arc(-9 + glare * 0.35, -11, 4, 0, Math.PI * 2);
  ctx.arc(9 - glare * 0.35, -11, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#1f2824";
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (state.level + state.roundNumber >= 6 || creature.boss) {
    ctx.moveTo(-22, -25);
    ctx.lineTo(-5, -18);
    ctx.moveTo(22, -25);
    ctx.lineTo(5, -18);
  } else {
    ctx.moveTo(-18, -23);
    ctx.lineTo(-3, -22);
    ctx.moveTo(18, -23);
    ctx.lineTo(3, -22);
  }
  ctx.stroke();

  ctx.beginPath();
  if (state.level + state.roundNumber >= 8 || creature.boss) {
    ctx.arc(0, 12, 13, 0.08, Math.PI - 0.08, true);
  } else {
    ctx.arc(0, 15, 12, 0.12, Math.PI - 0.12);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(31,40,36,0.75)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-14, 26);
  ctx.lineTo(-31, 38);
  ctx.moveTo(14, 26);
  ctx.lineTo(31, 38);
  ctx.stroke();
  ctx.restore();

  if (isTarget) drawCreatureWord(ctx, creature, x, y, stealable);
}

function drawCreatureWord(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  x: number,
  y: number,
  stealable: boolean,
) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (creature.boss) {
    drawBossQuote(ctx, creature, x, y, stealable);
    ctx.restore();
    return;
  }

  ctx.fillStyle = stealable ? "rgba(255,232,242,0.97)" : "rgba(255,252,218,0.98)";
  roundRect(ctx, x - wordWidth(creature.word) / 2 - 18, y - creature.radius - 68, wordWidth(creature.word) + 36, 48, 12);
  ctx.fill();
  ctx.strokeStyle = stealable ? "#ff8cab" : "#f4c542";
  ctx.lineWidth = 3;
  ctx.stroke();
  drawWordProgress(ctx, creature, x, y - creature.radius - 44, creature.active ? 30 : 24);
  if (creature.assignedPlayerName) {
    ctx.fillStyle = "#173d34";
    ctx.font = "800 16px 'Courier New', monospace";
    ctx.fillText(
      `${creature.assignedPlayerEmoji} ${stealable ? `steal from ${creature.assignedPlayerName}` : "you"}`,
      x,
      y - creature.radius - 91,
    );
  }
  ctx.restore();
}

function drawBossQuote(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  x: number,
  y: number,
  stealable: boolean,
) {
  const width = Math.min(740, GAME_WIDTH - 80);
  const top = Math.max(96, y - creature.radius - 122);
  const centerX = Math.max(width / 2 + 24, Math.min(GAME_WIDTH - width / 2 - 24, x));
  ctx.fillStyle = stealable ? "rgba(255,232,242,0.98)" : "rgba(255,248,216,0.98)";
  roundRect(ctx, centerX - width / 2, top, width, 92, 12);
  ctx.fill();
  ctx.strokeStyle = stealable ? "#ff8cab" : "#f4c542";
  ctx.lineWidth = 4;
  ctx.stroke();

  drawBossQuoteProgress(ctx, creature, centerX, top + 29);

  const progress = creature.typedIndex / Math.max(1, creature.word.length);
  ctx.fillStyle = "rgba(23,61,52,0.22)";
  ctx.fillRect(centerX - width / 2 + 22, top + 72, width - 44, 8);
  ctx.fillStyle = "#1f8b68";
  ctx.fillRect(centerX - width / 2 + 22, top + 72, (width - 44) * progress, 8);

  ctx.fillStyle = "#d94152";
  ctx.font = "800 15px 'Courier New', monospace";
  ctx.fillText(
    `${creature.assignedPlayerEmoji} ${stealable ? `HELP ${creature.assignedPlayerName}` : "YOUR BOSS"}`,
    centerX,
    top - 15,
  );
}

function drawBossQuoteProgress(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  centerX: number,
  startY: number,
) {
  const tokens = bossQuoteTokens(creature.displayText, creature.typedIndex);
  const lines = wrapBossTokens(tokens, 39).slice(0, 2);
  ctx.font = "800 18px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  lines.forEach((line, lineIndex) => {
    const text = line.map((token) => token.char).join("").toUpperCase();
    const spacing = 12;
    const startX = centerX - ((text.length - 1) * spacing) / 2;
    line.forEach((token, index) => {
      const x = startX + index * spacing;
      const y = startY + lineIndex * 23;
      if (token.status === "done") {
        ctx.fillStyle = "#1f8b68";
      } else if (token.status === "current") {
        ctx.fillStyle = "#cf7f14";
        ctx.strokeStyle = "rgba(255,215,90,0.72)";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#173d34";
      }
      ctx.strokeStyle = "rgba(255,252,218,0.86)";
      ctx.lineWidth = 4;
      ctx.strokeText(token.char.toUpperCase(), x, y);
      ctx.fillText(token.char.toUpperCase(), x, y);
    });
  });

  const next = creature.word[creature.typedIndex]?.toUpperCase() ?? "DONE";
  ctx.fillStyle = "#d94152";
  ctx.font = "900 16px 'Courier New', monospace";
  ctx.fillText(`NEXT: ${next}`, centerX, startY + 47);
}

function drawRoundPhaseOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.status !== "playing") return;
  if (state.roundPhase !== "intro" && state.roundPhase !== "bossWarning") return;

  ctx.save();
  ctx.fillStyle = "rgba(23, 61, 52, 0.58)";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (state.roundPhase === "intro") {
    ctx.fillStyle = "#ffef7b";
    ctx.strokeStyle = "#173d34";
    ctx.lineWidth = 7;
    ctx.font = "900 70px 'Courier New', monospace";
    ctx.strokeText(`ROUND ${state.roundNumber}`, GAME_WIDTH / 2, 190);
    ctx.fillText(`ROUND ${state.roundNumber}`, GAME_WIDTH / 2, 190);
    drawPreviewFly(ctx, state.roundNumber);
    ctx.fillStyle = "#fff8d8";
    ctx.font = "800 22px 'Courier New', monospace";
    ctx.fillText("another peaceful day by the pond...", GAME_WIDTH / 2, 365);
    ctx.fillText("until the flies remember your name.", GAME_WIDTH / 2, 394);
  } else {
    ctx.fillStyle = "#ff8cab";
    ctx.strokeStyle = "#173d34";
    ctx.lineWidth = 7;
    ctx.font = "900 54px 'Courier New', monospace";
    ctx.strokeText("BOSS FLY INCOMING", GAME_WIDTH / 2, 210);
    ctx.fillText("BOSS FLY INCOMING", GAME_WIDTH / 2, 210);
    ctx.fillStyle = "#fff8d8";
    ctx.font = "800 24px 'Courier New', monospace";
    ctx.fillText("doo  dooo  dooo", GAME_WIDTH / 2, 290);
  }
  ctx.restore();
}

function drawPreviewFly(ctx: CanvasRenderingContext2D, round: number) {
  ctx.save();
  ctx.translate(GAME_WIDTH / 2, 285);
  ctx.scale(1.45, 1.45);
  ctx.fillStyle = "rgba(221,250,255,0.75)";
  ctx.strokeStyle = "#173d34";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(-32, -12, 30, 15, -0.55, 0, Math.PI * 2);
  ctx.ellipse(32, -12, 30, 15, 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#171f1c";
  ctx.beginPath();
  ctx.ellipse(0, 0, 32, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f7fbff";
  ctx.beginPath();
  ctx.arc(-12, -13, 9, 0, Math.PI * 2);
  ctx.arc(12, -13, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1f2824";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-23, -25 - Math.min(10, round));
  ctx.lineTo(-4, -18);
  ctx.moveTo(23, -25 - Math.min(10, round));
  ctx.lineTo(4, -18);
  ctx.stroke();
  ctx.fillStyle = "#1f2824";
  ctx.beginPath();
  ctx.arc(-9, -12, 4, 0, Math.PI * 2);
  ctx.arc(9, -12, 4, 0, Math.PI * 2);
  ctx.fill();
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

function drawPlayerCreatures(ctx: CanvasRenderingContext2D, state: GameState) {
  const players =
    state.coopPlayers.length > 0
      ? state.coopPlayers
      : [
          {
            id: state.currentPlayerId || "solo",
            name: "You",
            emoji: "🐸",
            lettersTyped: 0,
            score: 0,
          },
        ];

  players.slice(0, 6).forEach((player, index) => {
    drawPlayerCreature(ctx, state, player, playerPosition(index, players.length), index);
  });
}

function drawPlayerCreature(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  player: CoopPlayer,
  position: { x: number; y: number },
  index: number,
) {
  const croaked = state.croakedPlayerIds.includes(player.id);
  const bob = state.settings.reducedMotion ? 0 : Math.sin(state.elapsedSeconds * 4) * 3;
  const current = player.id === state.currentPlayerId;
  ctx.save();
  ctx.translate(
    position.x,
    position.y + (croaked ? 10 : bob + Math.sin(state.elapsedSeconds * 2 + index) * 1.5),
  );
  ctx.globalAlpha = croaked ? 0.58 : current ? 1 : 0.84;

  drawLilyPad(ctx, 0, 28, current ? 68 : 56, 0.1);

  ctx.fillStyle = croaked ? "#8aa899" : current ? "#55c75c" : "#7ecf72";
  ctx.strokeStyle = "#173d34";
  ctx.lineWidth = current ? 5 : 4;
  ctx.beginPath();
  ctx.ellipse(0, 0, current ? 48 : 40, current ? 36 : 31, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = croaked ? "#a8baae" : "#79d96f";
  ctx.beginPath();
  ctx.arc(current ? -24 : -20, -18, current ? 15 : 13, 0, Math.PI * 2);
  ctx.arc(current ? 24 : 20, -18, current ? 15 : 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#173d34";
  if (croaked) {
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(current ? -25 : -21, -24);
    ctx.lineTo(current ? -13 : -11, -12);
    ctx.moveTo(current ? -13 : -11, -24);
    ctx.lineTo(current ? -25 : -21, -12);
    ctx.moveTo(current ? 13 : 11, -24);
    ctx.lineTo(current ? 25 : 21, -12);
    ctx.moveTo(current ? 25 : 21, -24);
    ctx.lineTo(current ? 13 : 11, -12);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(current ? -19 : -16, -18, current ? 5 : 4, 0, Math.PI * 2);
    ctx.arc(current ? 19 : 16, -18, current ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#ffdf6b";
  ctx.beginPath();
  ctx.arc(-6, 7, 4, 0, Math.PI * 2);
  ctx.arc(15, 13, 3, 0, Math.PI * 2);
  ctx.arc(-24, 6, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#173d34";
  ctx.lineWidth = current ? 5 : 4;
  ctx.beginPath();
  ctx.arc(0, 5, current ? 18 : 15, 0.08, Math.PI - 0.08);
  ctx.stroke();

  ctx.font = "800 22px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(player.emoji, 0, -48);

  ctx.font = "800 13px 'Courier New', monospace";
  ctx.fillStyle = current ? "#fff2b6" : "rgba(255,242,182,0.82)";
  ctx.strokeStyle = "#173d34";
  ctx.lineWidth = 4;
  const label = croaked ? "CROAKED" : current ? "YOU" : player.name.slice(0, 8).toUpperCase();
  ctx.strokeText(label, 0, 54);
  ctx.fillText(label, 0, 54);
  ctx.restore();
}

function drawLetterBursts(ctx: CanvasRenderingContext2D, state: GameState) {
  state.letterBursts.forEach((burst) => {
    const origin = playerPositionForId(state, burst.playerId);
    const ease = 1 - Math.pow(1 - burst.progress, 3);
    const x = burst.x + (burst.targetX - burst.x) * ease;
    const y = burst.y + (burst.targetY - burst.y) * ease;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - burst.progress * 0.35);
    ctx.strokeStyle = "#ff8cab";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y - 18);
    ctx.quadraticCurveTo((origin.x + x) / 2, y + 54, x, y);
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

function drawSparkles(ctx: CanvasRenderingContext2D, seed: number, radius: number) {
  ctx.save();
  ctx.fillStyle = "#fff27a";
  ctx.strokeStyle = "#173d34";
  ctx.lineWidth = 2;
  for (let index = 0; index < 7; index += 1) {
    const angle = seed * 1.7 + index * 0.9;
    const distance = radius + Math.sin(seed * 3 + index) * 8;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    ctx.beginPath();
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x + 4, y);
    ctx.lineTo(x, y + 7);
    ctx.lineTo(x - 4, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function currentPlayerPosition(state: GameState) {
  return playerPositionForId(state, state.currentPlayerId);
}

function playerPositionForId(state: GameState, playerId: string) {
  const players =
    state.coopPlayers.length > 0
      ? state.coopPlayers
      : [
          {
            id: state.currentPlayerId || "solo",
            name: "You",
            emoji: "🐸",
            lettersTyped: 0,
            score: 0,
          },
        ];
  const index = players.findIndex((player) => player.id === playerId);
  return playerPosition(index < 0 ? 0 : index, players.length);
}

function playerPosition(index: number, total: number) {
  if (total <= 1) return { x: PLAYER_X, y: PLAYER_Y };
  const spacing = Math.min(148, GAME_WIDTH / (total + 0.8));
  const start = GAME_WIDTH / 2 - ((total - 1) * spacing) / 2;
  return {
    x: start + index * spacing,
    y: PLAYER_Y + (index % 2 === 0 ? 0 : 10),
  };
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

function wrapText(text: string, maxLength: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function bossQuoteTokens(displayText: string, typedIndex: number) {
  let letterIndex = 0;
  return displayText.split("").map((char) => {
    if (!/[a-z]/i.test(char)) return { char, status: "plain" as const };
    const currentLetterIndex = letterIndex;
    letterIndex += 1;
    if (currentLetterIndex < typedIndex) return { char, status: "done" as const };
    if (currentLetterIndex === typedIndex) return { char, status: "current" as const };
    return { char, status: "todo" as const };
  });
}

function wrapBossTokens(tokens: ReturnType<typeof bossQuoteTokens>, maxLetters: number) {
  const lines: typeof tokens[] = [];
  let line: typeof tokens = [];
  let visibleLength = 0;
  for (const token of tokens) {
    if (visibleLength >= maxLetters && token.char === " ") {
      lines.push(line);
      line = [];
      visibleLength = 0;
      continue;
    }
    line.push(token);
    visibleLength += 1;
  }
  if (line.length > 0) lines.push(line);
  return lines;
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
