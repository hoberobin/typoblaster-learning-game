import type { MultiplayerPlayer } from "../multiplayer/types";

type ScoreboardBarProps = {
  players: MultiplayerPlayer[];
  currentPlayerId?: string;
  leaderId: string;
  teamLettersPerMinute: number;
};

export function ScoreboardBar({
  players,
  currentPlayerId,
  leaderId,
  teamLettersPerMinute,
}: ScoreboardBarProps) {
  if (players.length === 0) return null;
  const teamScore = players.reduce((total, player) => total + player.score, 0);
  const teamFlies = players.reduce((total, player) => total + player.wordsCompleted, 0);

  return (
    <section className="scoreboard-bar" aria-label="Multiplayer scores">
      <div className="team-pill">
        <span>Co-op</span>
        <strong>{teamScore.toLocaleString()}</strong>
        <em>{teamLettersPerMinute} LPM</em>
        <small>{teamFlies} flies</small>
      </div>
      {players.slice(0, 6).map((player) => {
        const leading = player.id === leaderId;
        return (
          <div
            className={`score-pill ${leading ? "leading" : ""} ${
              player.id === currentPlayerId ? "current" : ""
            }`}
            key={player.id}
          >
            <span className="score-avatar">{player.emoji}</span>
            <span className="score-name">{player.name}</span>
            <strong>{player.score.toLocaleString()}</strong>
            <span className="score-streak">x{player.streak}</span>
            {leading && <span className="score-flame">🔥</span>}
          </div>
        );
      })}
    </section>
  );
}
