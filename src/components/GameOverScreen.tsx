import type { GameSnapshot } from "../game/types";
import { formatTime } from "./format";

type GameOverScreenProps = {
  snapshot: GameSnapshot;
  onRestart: () => void;
  onTitle: () => void;
};

export function GameOverScreen({ snapshot, onRestart, onTitle }: GameOverScreenProps) {
  const practiceFocus = getPracticeFocus(snapshot);

  return (
    <div className="start-overlay">
      <section className="modal-card game-over-card">
        <div className="game-over-title">
          <p className="eyebrow danger-text">Pond Results</p>
          <h1>Frog Break</h1>
        </div>

        <div className="final-score-block">
          <span>Final Score</span>
          <strong>{snapshot.score.toLocaleString()}</strong>
        </div>

        <div className="stat-list">
          <div>
            <span>High Score</span>
            <strong>{snapshot.highScore.toLocaleString()}</strong>
          </div>
          <div>
            <span>Survival Time</span>
            <strong>{formatTime(snapshot.survivalTime)}</strong>
          </div>
          <div>
            <span>Longest Streak</span>
            <strong>x{snapshot.longestStreak}</strong>
          </div>
          <div>
            <span>Letters Typed</span>
            <strong>{snapshot.lettersTyped}</strong>
          </div>
          <div>
            <span>Accuracy</span>
            <strong>{snapshot.accuracy}%</strong>
          </div>
          <div>
            <span>Words Completed</span>
            <strong>{snapshot.wordsCompleted}</strong>
          </div>
          <div>
            <span>Level Reached</span>
            <strong>{snapshot.levelReached}</strong>
          </div>
        </div>

        <div className="practice-focus">
          <span>Practice Focus</span>
          <strong>{practiceFocus}</strong>
        </div>

        <div className="menu-stack">
          <button className="retro-button primary" onClick={onRestart}>
            Play Again
          </button>
          <button className="retro-button secondary" onClick={onTitle}>
            Back to Title
          </button>
        </div>
      </section>
    </div>
  );
}

function getPracticeFocus(snapshot: GameSnapshot) {
  if (snapshot.lettersTyped < 8) return "Try a longer run and watch the yellow letter.";
  if (snapshot.accuracy < 75) return "Slow down and match the yellow letter first.";
  if (snapshot.longestStreak < 5) return "Build a five-word streak with steady typing.";
  if (snapshot.wordsCompleted < 10) return "Catch ten flies before they reach the lily pad.";
  return "Great focus. Try the next pace when this feels easy.";
}
