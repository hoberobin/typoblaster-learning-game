import type { GameSnapshot } from "../game/types";

type HudProps = {
  snapshot: GameSnapshot;
};

export function Hud({ snapshot }: HudProps) {
  const wordProgress = snapshot.currentWord
    ? `${snapshot.currentWord.toUpperCase()} ${snapshot.typedIndex}/${snapshot.currentWord.length}`
    : "READY";

  return (
    <section className="hud-bar learning-hud" aria-label="Run status">
      <div className="hud-stat">
        <span>Score</span>
        <strong>{snapshot.score.toString().padStart(6, "0")}</strong>
      </div>
      <div className="hud-stat">
        <span>Words</span>
        <strong>{snapshot.wordsCompleted}</strong>
      </div>
      <div className="hud-stat">
        <span>Streak / Level</span>
        <strong>x{snapshot.streak} L{snapshot.level}</strong>
      </div>
      <div className="hud-stat current-word-stat">
        <span>Fly Word</span>
        <strong>{wordProgress}</strong>
      </div>
      <div className="hud-stat">
        <span>Accuracy</span>
        <strong>{snapshot.accuracy}%</strong>
      </div>
      <div className="hud-stat danger">
        <span>Frog Focus</span>
        <strong>{renderLives(snapshot.lives)}</strong>
      </div>
    </section>
  );
}

function renderLives(lives: number) {
  if (lives <= 0) return "rest";
  return Array.from({ length: lives }, () => "♥").join(" ");
}
