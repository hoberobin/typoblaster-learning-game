import { useEffect, useMemo, useState } from "react";
import { quizForWord } from "../game/wordDefinitions";
import type { GameSnapshot } from "../game/types";
import type { MultiplayerPlayer, TeamLeaderboardEntry } from "../multiplayer/types";
import { formatTime } from "./format";

type GameOverScreenProps = {
  snapshot: GameSnapshot;
  players: MultiplayerPlayer[];
  leaderboard: TeamLeaderboardEntry[];
  currentLeaderboardId: string;
  onRestart: () => void;
  onTitle: () => void;
  onBonusAnswer?: (correct: boolean) => void;
};

export function GameOverScreen({
  snapshot,
  players,
  leaderboard,
  currentLeaderboardId,
  onRestart,
  onTitle,
  onBonusAnswer,
}: GameOverScreenProps) {
  const practiceFocus = getPracticeFocus(snapshot);
  const [bonusAnswered, setBonusAnswered] = useState(false);
  const quizChoices = useMemo(
    () => (snapshot.hardestWord ? quizForWord(snapshot.hardestWord) : []),
    [snapshot.hardestWord],
  );
  const showBonusQuestion = snapshot.roundComplete && snapshot.hardestWord && !bonusAnswered;
  const rankedPlayers = useMemo(() => players.slice(0, 6), [players]);
  const currentRank = leaderboard.findIndex((entry) => entry.id === currentLeaderboardId) + 1;

  return (
    <div className="start-overlay">
      <section className="modal-card game-over-card">
        <div className="game-over-title">
          <p className="eyebrow danger-text">Pond Results</p>
          <h1>Frog Break</h1>
        </div>

        <div className="final-score-block">
          <div>
            <span>Team Score</span>
            <strong>{teamScore(rankedPlayers, snapshot).toLocaleString()}</strong>
          </div>
          <div className="team-rank-summary">
            <span>Your Team Rank</span>
            <strong>{currentRank > 0 ? `#${currentRank}` : "Syncing"}</strong>
          </div>
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

        {showBonusQuestion ? (
          <div className="bonus-quiz">
            <span>Bonus Word</span>
            <strong>{snapshot.hardestWord}</strong>
            <p>Pick the best definition for 100 points.</p>
            <div className="bonus-choice-list">
              {quizChoices.map((choice) => (
                <button
                  className="retro-button secondary"
                  key={choice.definition}
                  onClick={() => {
                    setBonusAnswered(true);
                    onBonusAnswer?.(choice.correct);
                  }}
                >
                  {choice.definition}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ArcadeScoreboard
            players={rankedPlayers}
            snapshot={snapshot}
            leaderboard={leaderboard}
            currentLeaderboardId={currentLeaderboardId}
          />
        )}

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

function ArcadeScoreboard({
  players,
  snapshot,
  leaderboard,
  currentLeaderboardId,
}: {
  players: MultiplayerPlayer[];
  snapshot: GameSnapshot;
  leaderboard: TeamLeaderboardEntry[];
  currentLeaderboardId: string;
}) {
  const roster =
    players.length > 0
      ? players
      : [
          {
            id: "solo",
            name: "You",
            emoji: "🐸",
            generation: 1,
            score: snapshot.score,
            streak: snapshot.streak,
            lettersTyped: snapshot.lettersTyped,
            accuracy: snapshot.accuracy,
            wordsCompleted: snapshot.wordsCompleted,
            lastSeenMs: Date.now(),
            online: true,
          },
        ];
  const quote = useMemo(() => pondKeatsQuote(), []);
  const totalLetters = roster.reduce((total, player) => total + player.lettersTyped, 0);
  const totalScore = roster.reduce((total, player) => total + player.score, 0);
  const currentRank = leaderboard.findIndex((entry) => entry.id === currentLeaderboardId) + 1;

  return (
    <section className="arcade-results" aria-label="Arcade score tally">
      <div className="winner-marquee">
        <div>
          <span>Frog Chorus</span>
          <strong>{roster.map((player) => `${player.emoji} ${player.name}`).join("  ")}</strong>
        </div>
        <div>
          <span>Total Letters</span>
          <strong>
            <AnimatedNumber value={totalLetters} />
          </strong>
        </div>
        <div>
          <span>Total Score</span>
          <strong>
            <AnimatedNumber value={totalScore} />
          </strong>
        </div>
      </div>

      <blockquote className="pond-quote">{quote}</blockquote>

      <div className="arcade-columns">
        {roster.map((player, index) => (
          <PlayerScoreColumn key={player.id} player={player} rank={index + 1} />
        ))}
      </div>

      <TeamLeaderboard
        entries={leaderboard}
        currentLeaderboardId={currentLeaderboardId}
        currentRank={currentRank}
      />
    </section>
  );
}

function TeamLeaderboard({
  entries,
  currentLeaderboardId,
  currentRank,
}: {
  entries: TeamLeaderboardEntry[];
  currentLeaderboardId: string;
  currentRank: number;
}) {
  return (
    <section className="team-leaderboard" aria-label="Team leaderboard">
      <div className="team-leaderboard-header">
        <div>
          <span>SEE YOUR FALLEN FROG-RADES</span>
          <strong>Previous team runs</strong>
        </div>
        <small>{currentRank > 0 ? `Current #${currentRank}` : "Rank syncing"}</small>
      </div>
      <div className="leaderboard-scroll">
        {entries.length === 0 ? (
          <p className="leaderboard-empty">The lily pads are still waiting for old legends.</p>
        ) : (
          entries.map((entry, index) => (
            <article
              className={`leaderboard-row ${
                entry.id === currentLeaderboardId ? "current-run" : ""
              }`}
              key={entry.id}
            >
              <strong>#{index + 1}</strong>
              <div>
                <span>
                  {entry.members
                    .map((member) => `${member.emoji} ${member.name}`)
                    .join("  ")}
                </span>
                <small>
                  Round {entry.roundNumber} · {entry.lettersTyped} letters ·{" "}
                  {entry.teamLettersPerMinute} LPM
                </small>
              </div>
              <b>{entry.score.toLocaleString()}</b>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function PlayerScoreColumn({ player, rank }: { player: MultiplayerPlayer; rank: number }) {
  const tally = scoreTally(player);

  return (
    <article className={`score-column rank-${rank}`}>
      <div className="score-column-header">
        <span className="podium-rank">{rank}</span>
        <strong>{player.emoji}</strong>
        <div>
          <span>{player.name}</span>
          <small>{player.wordsCompleted} flies</small>
        </div>
      </div>

      <ScoreLine label="Fly points" value={tally.flyPoints} />
      <ScoreLine label={`Streak x${player.streak}`} value={tally.streakPoints} />
      <ScoreLine label={`${player.lettersTyped} letters`} value={tally.letterPoints} />
      <ScoreLine label={`${player.accuracy}% accuracy`} value={tally.accuracyPoints} />

      <div className="score-final-line">
        <span>Total</span>
        <strong>
          <AnimatedNumber value={player.score} />
        </strong>
      </div>
    </article>
  );
}

function ScoreLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="score-add-line">
      <span>{label}</span>
      <strong>
        +<AnimatedNumber value={value} />
      </strong>
    </div>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const startedAt = performance.now();
    const duration = 1100 + Math.min(900, value * 1.6);

    const tick = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{displayValue.toLocaleString()}</>;
}

function scoreTally(player: MultiplayerPlayer) {
  const streakPoints = player.streak * 25;
  const letterPoints = player.lettersTyped * 2;
  const accuracyPoints = Math.round(player.accuracy * 7);
  const flyPoints = Math.max(0, player.score - streakPoints - letterPoints - accuracyPoints);
  return { accuracyPoints, flyPoints, letterPoints, streakPoints };
}

function teamScore(players: MultiplayerPlayer[], snapshot: GameSnapshot) {
  const total = players.reduce((sum, player) => sum + player.score, 0);
  return total || snapshot.score;
}

function pondKeatsQuote() {
  const quotes = [
    "A pond of beauty is a joy forever.",
    "Heard ripples are sweet, but the next frog croak is sweeter.",
    "The poetry of the pond is never dead.",
    "Bright frogs, full of ease, sing among the reeds.",
    "Touch has a memory, and so does the lily pad.",
  ];
  return quotes[Math.floor(Math.random() * quotes.length)];
}

function getPracticeFocus(snapshot: GameSnapshot) {
  if (snapshot.lettersTyped < 8) return "Try a longer run and watch the yellow letter.";
  if (snapshot.accuracy < 75) return "Slow down and match the yellow letter first.";
  if (snapshot.longestStreak < 5) return "Build a five-word streak with steady typing.";
  if (snapshot.wordsCompleted < 10) return "Catch ten flies before they reach the lily pad.";
  return "Great focus. Try the next pace when this feels easy.";
}
