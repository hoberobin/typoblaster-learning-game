export type PlayerProfile = {
  id: string;
  name: string;
  emoji: string;
  generation: number;
};

export type MultiplayerPlayer = PlayerProfile & {
  score: number;
  streak: number;
  lettersTyped: number;
  accuracy: number;
  wordsCompleted: number;
  lastSeenMs: number;
  online: boolean;
};

export type TeamLeaderboardMember = {
  id: string;
  name: string;
  emoji: string;
  score: number;
  lettersTyped: number;
};

export type TeamLeaderboardEntry = {
  id: string;
  score: number;
  roundNumber: number;
  lettersTyped: number;
  teamLettersPerMinute: number;
  members: TeamLeaderboardMember[];
  createdAtMs: number;
};

export type RemoteKeyEvent = {
  id: string;
  generation: number;
  playerId: string;
  playerName: string;
  playerEmoji: string;
  kind: "text" | "backspace";
  value: string;
  createdAtMs: number;
};

export type VoteChoice = "yes" | "no";

export type ResetVote = {
  id: string;
  requestedBy: string;
  requesterName: string;
  generation: number;
  createdAtMs: number;
  deadlineMs: number;
  status: "open" | "passed" | "rejected";
  votes: Record<string, VoteChoice>;
};

export type SessionMeta = {
  id: string;
  generation: number;
  createdAtMs: number;
  expiresAtMs: number;
  locked: boolean;
  currentVote: ResetVote | null;
};
