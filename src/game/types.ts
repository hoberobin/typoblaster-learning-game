export type GameStatus = "title" | "playing" | "paused" | "gameOver";
export type RoundPhase = "intro" | "swarm" | "bossWarning" | "boss";

export type Pace = "relaxed" | "normal" | "challenge" | "progressive";
export type GradeBand = "k2" | "g35" | "g68";
export type WordTier = 1 | 2 | 3;

export type GameSettings = {
  reducedMotion: boolean;
  screenShake: boolean;
  soundEnabled: boolean;
  pace: Pace;
  gradeBand: GradeBand;
};

export type WordEntry = {
  word: string;
  band: GradeBand;
  tier: WordTier;
};

export type CoopPlayer = {
  id: string;
  name: string;
  emoji: string;
  lettersTyped: number;
  score: number;
};

export type Creature = {
  id: string;
  word: string;
  displayText: string;
  band: GradeBand;
  assignedPlayerId: string | null;
  assignedPlayerName: string;
  assignedPlayerEmoji: string;
  bonus: boolean;
  recovery: boolean;
  boss: boolean;
  typedIndex: number;
  tier: WordTier;
  x: number;
  y: number;
  radius: number;
  speed: number;
  alive: boolean;
  active: boolean;
  breached: boolean;
  createdAt: number;
  wobbleSeed: number;
  color: string;
};

export type LetterBurst = {
  id: string;
  playerId: string;
  letter: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number;
  life: number;
  alive: boolean;
};

export type GameSyncState = {
  generation: number;
  hostId: string;
  status: GameStatus;
  elapsedSeconds: number;
  score: number;
  lives: number;
  streak: number;
  longestStreak: number;
  level: number;
  teamLettersPerMinute: number;
  roundNumber: number;
  roundPhase: RoundPhase;
  phaseStartedAt: number;
  bossWarningPlayed: boolean;
  lettersTyped: number;
  correctLetters: number;
  wrongLetters: number;
  wordsCompleted: number;
  teamFlyCount: number;
  croakedPlayerIds: string[];
  playerMissCounts: Record<string, number>;
  roundComplete: boolean;
  adaptivePressure: number;
  recoveryUntilSeconds: number;
  recoveryWordsRemaining: number;
  lastSpawnAt: number;
  spawnIntervalMs: number;
  lastDamageAt: number;
  creatures: Creature[];
  updatedAtMs: number;
};

export type Particle = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
};

export type FloatingText = {
  id: string;
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
};

export type GameState = {
  status: GameStatus;
  width: number;
  height: number;
  elapsedSeconds: number;
  score: number;
  highScore: number;
  lives: number;
  streak: number;
  longestStreak: number;
  level: number;
  teamLettersPerMinute: number;
  roundNumber: number;
  roundPhase: RoundPhase;
  phaseStartedAt: number;
  bossWarningPlayed: boolean;
  lettersTyped: number;
  correctLetters: number;
  wrongLetters: number;
  wordsCompleted: number;
  teamFlyCount: number;
  croakedPlayerIds: string[];
  playerMissCounts: Record<string, number>;
  completedWords: WordEntry[];
  roundComplete: boolean;
  bonusAwarded: boolean;
  adaptivePressure: number;
  breachWindowStartedAt: number;
  breachCountInWindow: number;
  recoveryUntilSeconds: number;
  recoveryWordsRemaining: number;
  lastSpawnAt: number;
  spawnIntervalMs: number;
  lastDamageAt: number;
  mistakeFlashTime: number;
  shakeTime: number;
  wordQueue: WordEntry[];
  settings: GameSettings;
  creatures: Creature[];
  coopPlayers: CoopPlayer[];
  currentPlayerId: string;
  letterBursts: LetterBurst[];
  particles: Particle[];
  floatingTexts: FloatingText[];
};

export type GameSnapshot = {
  status: GameStatus;
  score: number;
  highScore: number;
  lives: number;
  streak: number;
  level: number;
  teamLettersPerMinute: number;
  roundNumber: number;
  roundPhase: RoundPhase;
  roundTimeRemaining: number;
  accuracy: number;
  elapsedSeconds: number;
  longestStreak: number;
  lettersTyped: number;
  wordsCompleted: number;
  survivalTime: number;
  levelReached: number;
  currentWord: string;
  typedIndex: number;
  assignedPlayerName: string;
  assignedPlayerEmoji: string;
  teamFlyCount: number;
  gradeBand: GradeBand;
  hardestWord: string;
  roundComplete: boolean;
  croakedPlayerIds: string[];
  currentPlayerCroaked: boolean;
  currentPlayerMisses: number;
  currentPlayerMissesAllowed: number;
};

export type RunStats = {
  score: number;
  highScore: number;
  survivalTime: number;
  accuracy: number;
  longestStreak: number;
  levelReached: number;
  lettersTyped: number;
  wordsCompleted: number;
};
