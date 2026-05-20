import type { GameSnapshot } from "../game/types";

type HudProps = {
  snapshot: GameSnapshot;
};

export function Hud({ snapshot }: HudProps) {
  return (
    <section className="hud-bar learning-hud" aria-label="Run status">
      <div className="hud-stat">
        <span>Your Score</span>
        <strong>{snapshot.score.toString().padStart(6, "0")}</strong>
      </div>
      <div className="hud-stat">
        <span>Co-op Flies</span>
        <strong>{snapshot.teamFlyCount}</strong>
      </div>
      <div className="hud-stat">
        <span>Round / Streak</span>
        <strong>R{snapshot.roundNumber} x{snapshot.streak}</strong>
      </div>
      <div className="hud-stat current-word-stat">
        <span>Team LPM</span>
        <strong>{snapshot.teamLettersPerMinute}</strong>
      </div>
      <div className="hud-stat">
        <span>Accuracy</span>
        <strong>{snapshot.accuracy}%</strong>
      </div>
      <div className="hud-stat danger">
        <span>{snapshot.currentPlayerMissesAllowed > 1 ? "Croak Risk" : "Frog Focus"}</span>
        <strong>{renderLives(snapshot)}</strong>
      </div>
    </section>
  );
}

function renderLives(snapshot: GameSnapshot) {
  if (snapshot.currentPlayerMissesAllowed > 1) {
    if (snapshot.currentPlayerCroaked) return "croaked";
    const remaining = Math.max(
      0,
      snapshot.currentPlayerMissesAllowed - snapshot.currentPlayerMisses,
    );
    return `${remaining}/${snapshot.currentPlayerMissesAllowed}`;
  }
  if (snapshot.lives <= 0) return "rest";
  return Array.from({ length: snapshot.lives }, () => "♥").join(" ");
}
