import {
  GAME_HEIGHT,
  GAME_WIDTH,
  DANGER_LINE_Y,
  BOSS_WARNING_SECONDS,
  MAX_FLOATING_TEXTS,
  MAX_LETTER_BURSTS,
  MAX_PARTICLES,
  SWARM_ROUND_SECONDS,
} from "./constants";
import {
  activeCreature,
  activeCreatureForPlayer,
  addCorrectBurst,
  addMistakeFeedback,
  completeCreature,
  currentRequiredLetter,
  PLAYER_MISSES_ALLOWED,
  resolveBreaches,
} from "./collision";
import { isLetterKey, normalizeKey } from "./input";
import { render, resizeCanvas } from "./rendering";
import {
  ensureActiveCreature,
  promoteNextCreature,
  spawnPreviewCreatures,
  updateDifficulty,
  shuffledWords,
} from "./spawning";
import { loadHighScore, saveHighScore } from "./storage";
import type {
  CoopPlayer,
  Creature,
  GameSettings,
  GameSnapshot,
  GameState,
  GameSyncState,
  WordEntry,
} from "./types";
import { AudioSystem } from "./audio";

type SnapshotHandler = (snapshot: GameSnapshot) => void;
type TextInputBroadcaster = (value: string) => void;
type BackspaceBroadcaster = () => void;

export class GameEngine {
  private ctx: CanvasRenderingContext2D;
  private state: GameState;
  private rafId: number | null = null;
  private lastTimestamp = 0;
  private lastSnapshotAt = 0;
  private audio = new AudioSystem();
  private syncHost = true;
  private lastAppliedSyncAt = 0;
  private optimisticInputUntil = 0;
  private broadcastTextInput: TextInputBroadcaster = () => undefined;
  private broadcastBackspace: BackspaceBroadcaster = () => undefined;

  constructor(
    private canvas: HTMLCanvasElement,
    private onSnapshot: SnapshotHandler,
    settings: GameSettings,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context is unavailable.");
    this.ctx = ctx;
    this.state = createInitialState(settings, "title");
    resizeCanvas(this.canvas, this.ctx);
    this.emitSnapshot(0, true);
    this.loop = this.loop.bind(this);
  }

  startLoop() {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  dispose() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.audio.dispose();
  }

  resize() {
    resizeCanvas(this.canvas, this.ctx);
    render(this.ctx, this.state);
  }

  setSettings(settings: GameSettings) {
    const bandChanged = settings.gradeBand !== this.state.settings.gradeBand;
    this.state.settings = settings;
    if (bandChanged && this.state.status !== "playing") {
      this.state = createInitialState(settings, this.state.status);
    }
    if (this.state.status === "playing") {
      this.audio.startMusic(settings, this.state.level);
    } else if (!settings.soundEnabled) {
      this.audio.stopMusic();
    }
    this.emitSnapshot(performance.now(), true);
  }

  setCoopPlayers(players: CoopPlayer[], currentPlayerId: string) {
    this.state.coopPlayers = players.slice(0, 6);
    this.state.currentPlayerId = currentPlayerId;
    const playerIds = new Set(this.state.coopPlayers.map((player) => player.id));
    this.state.croakedPlayerIds = this.state.croakedPlayerIds.filter((id) => playerIds.has(id));
    this.state.playerMissCounts = Object.fromEntries(
      Object.entries(this.state.playerMissCounts).filter(([id]) => playerIds.has(id)),
    );
    if (this.state.status === "playing" && this.state.coopPlayers.length > 1) {
      this.state.lives = Math.max(0, this.state.coopPlayers.length - this.state.croakedPlayerIds.length);
    }
    this.updateTeamLettersPerMinute();
    this.assignWaitingCreatures();
    this.emitSnapshot(performance.now(), true);
  }

  setSyncHost(isHost: boolean) {
    this.syncHost = isHost;
  }

  setInputBroadcasters(
    textInput: TextInputBroadcaster,
    backspace: BackspaceBroadcaster,
  ) {
    this.broadcastTextInput = textInput;
    this.broadcastBackspace = backspace;
  }

  getSyncState(generation: number, hostId: string): GameSyncState {
    return {
      generation,
      hostId,
      status: this.state.status,
      elapsedSeconds: this.state.elapsedSeconds,
      score: this.state.score,
      lives: this.state.lives,
      streak: this.state.streak,
      longestStreak: this.state.longestStreak,
      level: this.state.level,
      teamLettersPerMinute: this.state.teamLettersPerMinute,
      roundNumber: this.state.roundNumber,
      roundPhase: this.state.roundPhase,
      phaseStartedAt: this.state.phaseStartedAt,
      bossWarningPlayed: this.state.bossWarningPlayed,
      lettersTyped: this.state.lettersTyped,
      correctLetters: this.state.correctLetters,
      wrongLetters: this.state.wrongLetters,
      wordsCompleted: this.state.wordsCompleted,
      teamFlyCount: this.state.teamFlyCount,
      croakedPlayerIds: [...this.state.croakedPlayerIds],
      playerMissCounts: { ...this.state.playerMissCounts },
      roundComplete: this.state.roundComplete,
      adaptivePressure: this.state.adaptivePressure,
      recoveryUntilSeconds: this.state.recoveryUntilSeconds,
      recoveryWordsRemaining: this.state.recoveryWordsRemaining,
      lastSpawnAt: this.state.lastSpawnAt,
      spawnIntervalMs: this.state.spawnIntervalMs,
      lastDamageAt: this.state.lastDamageAt,
      creatures: this.state.creatures.map((creature) => ({ ...creature })),
      updatedAtMs: Date.now(),
    };
  }

  applySyncState(sync: GameSyncState) {
    if (this.syncHost || sync.updatedAtMs <= this.lastAppliedSyncAt) return;
    const optimisticCreature = this.currentOptimisticCreature();
    this.lastAppliedSyncAt = sync.updatedAtMs;
    this.state.status = sync.status;
    this.state.elapsedSeconds = sync.elapsedSeconds;
    this.state.score = sync.score;
    this.state.lives = sync.lives;
    this.state.streak = sync.streak;
    this.state.longestStreak = sync.longestStreak;
    this.state.level = sync.level;
    this.state.teamLettersPerMinute = sync.teamLettersPerMinute;
    this.state.roundNumber = sync.roundNumber;
    this.state.roundPhase = sync.roundPhase;
    this.state.phaseStartedAt = sync.phaseStartedAt;
    this.state.bossWarningPlayed = sync.bossWarningPlayed;
    this.state.lettersTyped = sync.lettersTyped;
    this.state.correctLetters = sync.correctLetters;
    this.state.wrongLetters = sync.wrongLetters;
    this.state.wordsCompleted = sync.wordsCompleted;
    this.state.teamFlyCount = sync.teamFlyCount;
    this.state.croakedPlayerIds = [...sync.croakedPlayerIds];
    this.state.playerMissCounts = { ...sync.playerMissCounts };
    this.state.roundComplete = sync.roundComplete;
    this.state.adaptivePressure = sync.adaptivePressure;
    this.state.recoveryUntilSeconds = sync.recoveryUntilSeconds;
    this.state.recoveryWordsRemaining = sync.recoveryWordsRemaining;
    this.state.lastSpawnAt = sync.lastSpawnAt;
    this.state.spawnIntervalMs = sync.spawnIntervalMs;
    this.state.lastDamageAt = sync.lastDamageAt;
    this.state.creatures = sync.creatures.map((creature) => ({ ...creature }));
    this.mergeOptimisticCreature(optimisticCreature);
    if (sync.status === "playing") {
      this.audio.startMusic(this.state.settings, this.state.level);
    } else {
      this.audio.stopMusic();
    }
    this.assignWaitingCreatures();
    this.emitSnapshot(performance.now(), true);
  }

  showTitle() {
    this.audio.stopMusic();
    const coopPlayers = this.state.coopPlayers;
    const currentPlayerId = this.state.currentPlayerId;
    this.state = createInitialState(this.state.settings, "title");
    this.state.coopPlayers = coopPlayers;
    this.state.currentPlayerId = currentPlayerId;
    this.emitSnapshot(performance.now(), true);
  }

  start() {
    const coopPlayers = this.state.coopPlayers;
    const currentPlayerId = this.state.currentPlayerId;
    this.state = createInitialState(this.state.settings, "playing");
    this.state.coopPlayers = coopPlayers;
    this.state.currentPlayerId = currentPlayerId;
    this.state.lives = Math.max(1, coopPlayers.length || 3);
    this.lastTimestamp = performance.now();
    this.startRound(1);
    this.audio.startMusic(this.state.settings, this.state.level);
    this.emitSnapshot(this.lastTimestamp, true);
  }

  restart() {
    this.start();
  }

  awardBonusPoints(points: number) {
    if (this.state.bonusAwarded || points <= 0) return;
    this.state.bonusAwarded = true;
    this.state.score += points;
    if (this.state.score > this.state.highScore) {
      this.state.highScore = this.state.score;
      saveHighScore(this.state.score);
    }
    this.emitSnapshot(performance.now(), true);
  }

  playJoinCroak() {
    this.audio.play("croak", this.state.settings);
  }

  pause() {
    if (this.state.status !== "playing") return;
    this.state.status = "paused";
    this.audio.stopMusic();
    this.emitSnapshot(performance.now(), true);
  }

  resume() {
    if (this.state.status !== "paused") return;
    this.state.status = "playing";
    this.lastTimestamp = performance.now();
    this.audio.startMusic(this.state.settings, this.state.level);
    this.emitSnapshot(this.lastTimestamp, true);
  }

  handleTextInput(value: string) {
    let accepted = "";
    for (const char of value) {
      const key = normalizeKey(char);
      if (!isLetterKey(key)) continue;
      const letter = key.toLowerCase();
      accepted += letter;
      this.handleLetter(letter);
    }
    if (accepted) this.broadcastTextInput(accepted);
  }

  handleRemoteTextInput(playerId: string, value: string) {
    if (playerId === this.state.currentPlayerId) return;
    for (const char of value) {
      const key = normalizeKey(char);
      if (isLetterKey(key)) this.handleLetterForPlayer(key.toLowerCase(), playerId, false);
    }
  }

  handleBackspace() {
    if (this.state.status !== "playing") return;
    const creature = activeCreature(this.state);
    if (!creature || creature.typedIndex <= 0) return;
    if (!this.syncHost) this.optimisticInputUntil = performance.now() + 1600;
    creature.typedIndex -= 1;
    this.broadcastBackspace();
    this.emitSnapshot(performance.now(), true);
  }

  handleRemoteBackspace(playerId: string) {
    if (playerId === this.state.currentPlayerId || this.state.status !== "playing") return;
    const creature = activeCreatureForPlayer(this.state, playerId);
    if (!creature || creature.typedIndex <= 0) return;
    creature.typedIndex -= 1;
    this.emitSnapshot(performance.now(), true);
  }

  handleKeyDown(event: KeyboardEvent) {
    const key = normalizeKey(event.key);

    if (key === "ENTER") {
      if (this.state.status === "title") this.start();
      else if (this.state.status === "gameOver") this.restart();
      return;
    }

    if (key === "ESCAPE") {
      if (this.state.status === "playing") this.pause();
      else if (this.state.status === "paused") this.resume();
      return;
    }

    if (key === "BACKSPACE") {
      this.handleBackspace();
      return;
    }

    if (this.state.status !== "playing" || !isLetterKey(key)) return;
    this.handleTextInput(key.toLowerCase());
  }

  private handleLetter(letter: string) {
    this.handleLetterForPlayer(letter, this.state.currentPlayerId, true);
  }

  private handleLetterForPlayer(letter: string, playerId: string, audible: boolean) {
    if (this.state.croakedPlayerIds.includes(playerId)) return;
    const creature = activeCreatureForPlayer(this.state, playerId);
    if (!creature) return;
    if (playerId === this.state.currentPlayerId && !this.syncHost) {
      this.optimisticInputUntil = performance.now() + 1600;
    }

    this.state.lettersTyped += 1;
    if (letter === currentRequiredLetter(creature)) {
      this.state.correctLetters += 1;
      creature.typedIndex += 1;
      addCorrectBurst(this.state, letter, creature, playerId);
      if (audible) this.audio.play("hit", this.state.settings);

      if (creature.typedIndex >= creature.word.length) {
        completeCreature(this.state, creature, playerId);
        if (this.state.roundPhase === "boss") {
          this.finishBossIfCleared();
        } else {
          this.assignLowestFlyToPlayer(playerId);
          promoteNextCreature(this.state);
          ensureActiveCreature(this.state, performance.now());
        }
      }
    } else {
      this.state.wrongLetters += 1;
      this.state.streak = 0;
      addCorrectBurst(this.state, letter, creature, playerId);
      addMistakeFeedback(this.state, creature);
      if (audible) this.audio.play("damage", this.state.settings);
    }

    this.emitSnapshot(performance.now(), true);
  }

  private currentOptimisticCreature() {
    if (this.syncHost || performance.now() > this.optimisticInputUntil) return null;
    const creature = activeCreatureForPlayer(this.state, this.state.currentPlayerId);
    if (!creature) return null;
    return {
      id: creature.id,
      typedIndex: creature.typedIndex,
      alive: creature.alive,
      assignedPlayerId: creature.assignedPlayerId,
    };
  }

  private mergeOptimisticCreature(
    optimisticCreature: {
      id: string;
      typedIndex: number;
      alive: boolean;
      assignedPlayerId: string | null;
    } | null,
  ) {
    if (!optimisticCreature || this.state.croakedPlayerIds.includes(this.state.currentPlayerId)) {
      return;
    }
    const syncedCreature = this.state.creatures.find(
      (creature) =>
        creature.id === optimisticCreature.id &&
        creature.assignedPlayerId === optimisticCreature.assignedPlayerId,
    );
    if (!syncedCreature) return;
    syncedCreature.typedIndex = Math.max(syncedCreature.typedIndex, optimisticCreature.typedIndex);
  }

  private loop(timestamp: number) {
    const dt = Math.min(Math.max((timestamp - this.lastTimestamp) / 1000, 0), 0.033);
    this.lastTimestamp = timestamp;

    if (this.state.status === "playing") {
      this.update(dt, timestamp);
    }

    render(this.ctx, this.state);
    this.emitSnapshot(timestamp);
    this.rafId = requestAnimationFrame(this.loop);
  }

  private update(dt: number, timestamp: number) {
    this.state.elapsedSeconds += dt;

    if (!this.syncHost) {
      this.updateFollower(dt);
      return;
    }

    this.updateRoundPhase(timestamp);

    this.state.shakeTime = Math.max(0, this.state.shakeTime - dt);
    this.state.mistakeFlashTime = Math.max(0, this.state.mistakeFlashTime - dt);

    this.updateTeamLettersPerMinute();
    updateDifficulty(this.state);
    this.audio.updateMusic(this.state.settings, this.state.level);
    ensureActiveCreature(this.state, timestamp);
    spawnPreviewCreatures(this.state, timestamp);

    for (const burst of this.state.letterBursts) {
      burst.progress += dt / burst.life;
      if (burst.progress >= 1) burst.alive = false;
    }

    for (const creature of this.state.creatures) {
      creature.y += creature.speed * dt;
    }

    for (const particle of this.state.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 280 * dt;
      particle.life -= dt;
    }

    for (const text of this.state.floatingTexts) {
      text.y += text.vy * dt;
      text.life -= dt;
    }

    resolveBreaches(
      this.state,
      () => this.audio.play("damage", this.state.settings),
      () => this.endGame(),
    );
    if (this.state.status === "gameOver") return;
    promoteNextCreature(this.state);
    this.assignWaitingCreatures();
    this.finishBossIfCleared();
    this.cleanup();
  }

  private updateFollower(dt: number) {
    this.state.shakeTime = Math.max(0, this.state.shakeTime - dt);
    this.state.mistakeFlashTime = Math.max(0, this.state.mistakeFlashTime - dt);

    for (const burst of this.state.letterBursts) {
      burst.progress += dt / burst.life;
      if (burst.progress >= 1) burst.alive = false;
    }

    for (const creature of this.state.creatures) {
      creature.y += creature.speed * dt;
    }

    for (const particle of this.state.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 280 * dt;
      particle.life -= dt;
    }

    for (const text of this.state.floatingTexts) {
      text.y += text.vy * dt;
      text.life -= dt;
    }

    this.assignWaitingCreatures();
    promoteNextCreature(this.state);
    this.cleanup();
  }

  private updateRoundPhase(timestamp: number) {
    if (this.state.roundPhase === "intro" && this.state.elapsedSeconds - this.state.phaseStartedAt >= 1.8) {
      this.state.roundPhase = "swarm";
      this.state.phaseStartedAt = this.state.elapsedSeconds;
      this.state.lastSpawnAt = timestamp - this.state.spawnIntervalMs;
      ensureActiveCreature(this.state, timestamp);
      this.assignWaitingCreatures();
      return;
    }

    if (
      this.state.roundPhase === "swarm" &&
      this.state.elapsedSeconds - this.state.phaseStartedAt >= SWARM_ROUND_SECONDS
    ) {
      this.state.roundPhase = "bossWarning";
      this.state.phaseStartedAt = this.state.elapsedSeconds;
      this.state.bossWarningPlayed = false;
      this.state.creatures = [];
      this.audio.stopMusic();
      return;
    }

    if (this.state.roundPhase === "bossWarning") {
      if (!this.state.bossWarningPlayed) {
        this.state.bossWarningPlayed = true;
        this.audio.play("bossWarning", this.state.settings);
      }

      if (this.state.elapsedSeconds - this.state.phaseStartedAt >= BOSS_WARNING_SECONDS) {
        this.startBossPhase();
      }
    }
  }

  private startRound(roundNumber: number) {
    this.state.roundNumber = roundNumber;
    this.state.level = roundNumber;
    this.state.roundPhase = "intro";
    this.state.phaseStartedAt = this.state.elapsedSeconds;
    this.state.bossWarningPlayed = false;
    this.state.creatures = [];
    this.state.wordQueue = shuffledWords(this.state);
  }

  private startBossPhase() {
    this.state.roundPhase = "boss";
    this.state.phaseStartedAt = this.state.elapsedSeconds;
    this.state.creatures = [];
    this.spawnBosses();
    promoteNextCreature(this.state);
    this.audio.startMusic(this.state.settings, this.state.level);
  }

  private spawnBosses() {
    const players = this.state.coopPlayers.length > 0
      ? this.state.coopPlayers
          .filter((player) => !this.state.croakedPlayerIds.includes(player.id))
          .slice(0, 6)
      : [{ id: this.state.currentPlayerId || "solo", name: "You", emoji: "🐸", lettersTyped: 0, score: 0 }];
    const spacing = GAME_WIDTH / (players.length + 1);

    players.forEach((player, index) => {
      const quote = bossQuoteFor(this.state.roundNumber + index, this.currentTeamLettersPerMinute());
      const word = normalizeBossText(quote);
      const distance = DANGER_LINE_Y - 86;
      const lettersPerSecond = Math.max(0.9, this.currentTeamLettersPerMinute() / 60);
      const targetSeconds = Math.max(12, Math.min(34, (word.length / lettersPerSecond) * 1.18));
      const roundPressure = Math.max(0, this.state.roundNumber - 1) * 0.08;
      const speed = Math.max(12, Math.min(32, distance / targetSeconds + roundPressure));

      this.state.creatures.push({
        id: `boss-${player.id}-${this.state.roundNumber}`,
        word,
        displayText: quote,
        band: "g68",
        assignedPlayerId: player.id,
        assignedPlayerName: player.name,
        assignedPlayerEmoji: player.emoji,
        bonus: true,
        recovery: false,
        boss: true,
        typedIndex: 0,
        tier: 3,
        x: spacing * (index + 1),
        y: -110,
        radius: 76 + Math.min(18, this.state.roundNumber * 3),
        speed,
        alive: true,
        active: player.id === this.state.currentPlayerId,
        breached: false,
        createdAt: performance.now(),
        wobbleSeed: Math.random() * Math.PI * 2,
        color: "#d94152",
      });
    });
  }

  private finishBossIfCleared() {
    if (this.state.roundPhase !== "boss") return;
    if (this.state.creatures.some((creature) => creature.alive && creature.boss)) return;
    this.state.roundComplete = true;
    this.state.roundNumber += 1;
    this.state.roundComplete = false;
    this.startRound(this.state.roundNumber);
  }

  private currentLettersPerMinute() {
    const minutes = Math.max(0.25, this.state.elapsedSeconds / 60);
    return Math.max(28, this.state.correctLetters / minutes);
  }

  private currentTeamLettersPerMinute() {
    this.updateTeamLettersPerMinute();
    return Math.max(32, this.state.teamLettersPerMinute || this.currentLettersPerMinute());
  }

  private updateTeamLettersPerMinute() {
    const minutes = Math.max(0.25, this.state.elapsedSeconds / 60);
    const syncedLetters = this.state.coopPlayers.reduce(
      (total, player) => total + Math.max(0, player.lettersTyped),
      0,
    );
    this.state.teamLettersPerMinute = Math.round(
      Math.max(syncedLetters, this.state.lettersTyped) / minutes,
    );
  }

  private assignWaitingCreatures() {
    const players = this.state.coopPlayers;
    if (players.length === 0) return;
    if (this.state.roundPhase === "boss") {
      for (const creature of this.state.creatures) {
        if (!creature.boss) continue;
        const ownBoss = this.state.creatures.some(
          (entry) =>
            entry.alive &&
            entry.boss &&
            entry.assignedPlayerId === this.state.currentPlayerId &&
            !this.state.croakedPlayerIds.includes(this.state.currentPlayerId),
        );
        creature.active = creature.assignedPlayerId === this.state.currentPlayerId || !ownBoss;
      }
      return;
    }

    for (const player of players.filter((player) => !this.state.croakedPlayerIds.includes(player.id))) {
      const hasAssigned = this.state.creatures.some(
        (creature) => creature.alive && creature.assignedPlayerId === player.id,
      );
      if (hasAssigned) continue;
      this.assignLowestFly(player);
    }

    for (const creature of this.state.creatures) {
      creature.active =
        (creature.assignedPlayerId === this.state.currentPlayerId &&
          !this.state.croakedPlayerIds.includes(this.state.currentPlayerId)) ||
        (creature.assignedPlayerId !== null &&
          creature.assignedPlayerId !== this.state.currentPlayerId &&
          !this.state.croakedPlayerIds.includes(this.state.currentPlayerId) &&
          creature.y + creature.radius >= DANGER_LINE_Y - creature.radius * 2);
    }
  }

  private assignLowestFlyToCurrentPlayer() {
    this.assignLowestFlyToPlayer(this.state.currentPlayerId);
  }

  private assignLowestFlyToPlayer(playerId: string) {
    const player = this.state.coopPlayers.find((entry) => entry.id === playerId);
    if (!player) return;
    this.assignLowestFly(player);
  }

  private assignLowestFly(player: CoopPlayer) {
    const creature = [...this.state.creatures]
      .filter((entry) => entry.alive && entry.assignedPlayerId === null)
      .sort((left, right) => right.y - left.y)[0];
    if (!creature) return;

    creature.assignedPlayerId = player.id;
    creature.assignedPlayerName = player.name;
    creature.assignedPlayerEmoji = player.emoji;
    creature.active = player.id === this.state.currentPlayerId;
  }

  private cleanup() {
    this.state.letterBursts = this.state.letterBursts
      .filter((burst) => burst.alive)
      .slice(-MAX_LETTER_BURSTS);
    this.state.creatures = this.state.creatures.filter((creature) => creature.alive);
    this.state.particles = this.state.particles
      .filter((particle) => particle.life > 0)
      .slice(-MAX_PARTICLES);
    this.state.floatingTexts = this.state.floatingTexts
      .filter((text) => text.life > 0)
      .slice(-MAX_FLOATING_TEXTS);
  }

  private endGame() {
    this.state.status = "gameOver";
    this.audio.stopMusic();
    if (this.state.score > this.state.highScore) {
      this.state.highScore = this.state.score;
      saveHighScore(this.state.score);
    }
    this.audio.play("gameOver", this.state.settings);
    this.emitSnapshot(performance.now(), true);
  }

  private emitSnapshot(timestamp: number, force = false) {
    if (!force && timestamp - this.lastSnapshotAt < 80) return;
    this.lastSnapshotAt = timestamp;
    this.onSnapshot(toSnapshot(this.state));
  }
}

function createInitialState(settings: GameSettings, status: GameState["status"]): GameState {
  const state: GameState = {
    status,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    elapsedSeconds: 0,
    score: 0,
    highScore: loadHighScore(),
    lives: 3,
    streak: 0,
    longestStreak: 0,
    level: 1,
    teamLettersPerMinute: 0,
    roundNumber: 1,
    roundPhase: "intro",
    phaseStartedAt: 0,
    bossWarningPlayed: false,
    lettersTyped: 0,
    correctLetters: 0,
    wrongLetters: 0,
    wordsCompleted: 0,
    teamFlyCount: 0,
    croakedPlayerIds: [],
    playerMissCounts: {},
    completedWords: [],
    roundComplete: false,
    bonusAwarded: false,
    adaptivePressure: 0,
    breachWindowStartedAt: -999,
    breachCountInWindow: 0,
    recoveryUntilSeconds: 0,
    recoveryWordsRemaining: 0,
    lastSpawnAt: 0,
    spawnIntervalMs: 3300,
    lastDamageAt: -999,
    mistakeFlashTime: 0,
    shakeTime: 0,
    wordQueue: [],
    settings,
    creatures: [],
    coopPlayers: [],
    currentPlayerId: "",
    letterBursts: [],
    particles: [],
    floatingTexts: [],
  };
  state.wordQueue = shuffledWords(state);
  return state;
}

function toSnapshot(state: GameState): GameSnapshot {
  const active = activeCreature(state);
  const accuracy =
    state.lettersTyped === 0 ? 100 : Math.round((state.correctLetters / state.lettersTyped) * 100);
  return {
    status: state.status,
    score: state.score,
    highScore: state.highScore,
    lives: state.lives,
    streak: state.streak,
    level: state.level,
    accuracy,
    elapsedSeconds: state.elapsedSeconds,
    longestStreak: state.longestStreak,
    lettersTyped: state.lettersTyped,
    wordsCompleted: state.wordsCompleted,
    survivalTime: state.elapsedSeconds,
    levelReached: state.level,
    teamLettersPerMinute: state.teamLettersPerMinute,
    roundNumber: state.roundNumber,
    roundPhase: state.roundPhase,
    roundTimeRemaining: roundTimeRemaining(state),
    currentWord: active?.word ?? "",
    typedIndex: active?.typedIndex ?? 0,
    assignedPlayerName: active?.assignedPlayerName ?? "",
    assignedPlayerEmoji: active?.assignedPlayerEmoji ?? "",
    teamFlyCount: state.teamFlyCount,
    gradeBand: state.settings.gradeBand,
    hardestWord: hardestWord(state.completedWords),
    roundComplete: state.roundComplete,
    croakedPlayerIds: [...state.croakedPlayerIds],
    currentPlayerCroaked: state.croakedPlayerIds.includes(state.currentPlayerId),
    currentPlayerMisses: state.playerMissCounts[state.currentPlayerId] ?? 0,
    currentPlayerMissesAllowed: state.coopPlayers.length > 1 ? PLAYER_MISSES_ALLOWED : 1,
  };
}

function roundTimeRemaining(state: GameState) {
  if (state.roundPhase === "swarm") {
    return Math.max(0, SWARM_ROUND_SECONDS - (state.elapsedSeconds - state.phaseStartedAt));
  }
  if (state.roundPhase === "bossWarning") {
    return Math.max(0, BOSS_WARNING_SECONDS - (state.elapsedSeconds - state.phaseStartedAt));
  }
  return 0;
}

function normalizeBossText(text: string) {
  return text.toLowerCase().replace(/[^a-z]/g, "");
}

function bossQuoteFor(seed: number, lpm: number) {
  const short = [
    "The frog sings where the soft reeds gleam",
    "Bright pond joy stays with the patient frog",
    "A lily hush can hold a little song",
  ];
  const medium = [
    "A thing of pond beauty is a joy forever",
    "Heard ripples are sweet but frog songs sweeter",
    "The poetry of earth is never dead beside the reeds",
  ];
  const long = [
    "Bright frogs full of ease sing among cool reeds and silver flies",
    "My heart aches then wakes where the lily moon keeps watch",
    "Season of mist and mellow frogfulness bless this buzzing pond",
  ];
  const pool = lpm < 55 ? short : lpm < 85 ? medium : long;
  return pool[seed % pool.length];
}

function hardestWord(words: WordEntry[]) {
  return [...words].sort((left, right) => wordWeight(right) - wordWeight(left))[0]?.word ?? "";
}

function wordWeight(entry: WordEntry) {
  const rare = (entry.word.match(/[jqxzvy]/g) ?? []).length;
  return entry.tier * 100 + entry.word.length * 4 + rare * 9;
}
